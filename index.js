/**
 * Host half of dsh-side-chat.
 *
 * The Client creates the side conversation; this half lets it hand over the
 * main conversation as invisible context. `agent.inject()` queues a user-role
 * message whose `source.kind` is not `user`, so the browser Chat projects it as
 * an ordinary context row and hides it, while the model reads it on the next
 * pre-step. The side panel therefore stays clean and still knows the main line.
 */
import { randomUUID } from 'node:crypto';

const INJECT_PATH = '/sidechat/inject';
const EVENT_PATH = '/sidechat/event';
const ASK_PATH = '/sidechat/ask';
const MAX_EVENTS = 600;
const MAX_CHARS = 16000;

function textOf(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

/** Extract the readable passage of one durable event, for citation expansion. */
function recipeText(event) {
  if (!event || !event.data) return '';
  if (event.type === 'user/message') return textOf(event.data.content);
  if (event.type === 'assistant/message') {
    const message = event.data.message;
    return message ? textOf(message.content) : '';
  }
  return '';
}

/** Project the main transcript into a compact, human-readable context block. */
function collectContext(events) {
  const lines = [];
  for (const event of events.slice(-MAX_EVENTS)) {
    if (event.type === 'user/message') {
      const data = event.data;
      if (!data || !Array.isArray(data.content)) continue;
      const kind = data.source && data.source.kind ? data.source.kind : 'user';
      if (kind !== 'user') continue;
      const text = textOf(data.content);
      if (text) lines.push(`【用户】${text}`);
      continue;
    }
    if (event.type === 'assistant/message') {
      const message = event.data && event.data.message;
      const text = message ? textOf(message.content) : '';
      if (text) lines.push(`【助手】${text}`);
    }
  }
  let joined = lines.join('\n\n');
  if (joined.length > MAX_CHARS) joined = joined.slice(joined.length - MAX_CHARS);
  return joined;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

export function apply(ctx) {
  ctx.inject(['webServer', 'agents', 'sessionQuery'], (web) => {
    web.effect(() => web.webServer.register({
      kind: 'exact',
      path: ASK_PATH,
      async handler(request, response) {
        if (request.method !== 'POST') {
          send(response, 405, { error: 'method' });
          return;
        }
        let body;
        try {
          body = await readJson(request);
        } catch {
          send(response, 400, { error: 'json' });
          return;
        }
        const childSessionId = body && body.childSessionId;
        const text = body && body.text;
        if (typeof childSessionId !== 'string' || typeof text !== 'string' || text.length === 0) {
          send(response, 400, { error: 'ids' });
          return;
        }
        const agent = web.agents.get(childSessionId);
        if (agent === undefined) {
          send(response, 409, { error: 'no-agent' });
          return;
        }
        try {
          agent.followup({
            id: randomUUID(),
            role: 'user',
            content: [{ type: 'text', text }],
            source: { kind: 'user' },
          });
          send(response, 200, { ok: true });
        } catch (cause) {
          send(response, 500, { error: 'followup', detail: String(cause) });
        }
      },
    }), 'dsh-side-chat: ask route');

    web.effect(() => web.webServer.register({
      kind: 'exact',
      path: EVENT_PATH,
      async handler(request, response) {
        if (request.method !== 'GET') {
          send(response, 405, { error: 'method' });
          return;
        }
        const url = new URL(request.url || '', 'http://localhost');
        const sessionId = url.searchParams.get('sessionId');
        const seqText = url.searchParams.get('seq');
        const seq = seqText === null ? NaN : Number(seqText);
        if (typeof sessionId !== 'string' || !Number.isFinite(seq)) {
          send(response, 400, { error: 'args' });
          return;
        }
        let observed;
        try {
          observed = await web.sessionQuery.observeSession(sessionId);
        } catch (cause) {
          send(response, 404, { error: 'session', detail: String(cause) });
          return;
        }
        try {
          const event = (observed.events || []).find((entry) => entry.seq === seq);
          send(response, 200, { text: recipeText(event), type: event ? event.type : null });
        } finally {
          try {
            if (observed && typeof observed[Symbol.dispose] === 'function') observed[Symbol.dispose]();
            else if (observed && typeof observed.dispose === 'function') observed.dispose();
          } catch { /* release is best effort */ }
        }
      },
    }), 'dsh-side-chat: event route');

    web.effect(() => web.webServer.register({
      kind: 'exact',
      path: INJECT_PATH,
      async handler(request, response) {
        if (request.method !== 'POST') {
          send(response, 405, { error: 'method' });
          return;
        }
        let body;
        try {
          body = await readJson(request);
        } catch {
          send(response, 400, { error: 'json' });
          return;
        }
        const childSessionId = body && body.childSessionId;
        const parentSessionId = body && body.parentSessionId;
        if (typeof childSessionId !== 'string' || typeof parentSessionId !== 'string') {
          send(response, 400, { error: 'ids' });
          return;
        }
        const agent = web.agents.get(childSessionId);
        if (agent === undefined) {
          send(response, 409, { error: 'no-agent' });
          return;
        }
        let observed;
        try {
          observed = await web.sessionQuery.observeSession(parentSessionId);
        } catch (cause) {
          send(response, 404, { error: 'parent-unavailable', detail: String(cause) });
          return;
        }
        try {
          const context = collectContext(observed.events || []);
          if (context.length === 0) {
            send(response, 200, { ok: true, chars: 0 });
            return;
          }
          agent.inject({
            id: randomUUID(),
            role: 'user',
            content: [{
              type: 'text',
              text: '下面是主对话的上下文，供你在侧边聊天中回答问题时参考。不要逐字复述它，也不要假装它是用户刚说的话。\n\n'
                + context,
            }],
            source: { kind: 'sidechat-context' },
          });
          send(response, 200, { ok: true, chars: context.length });
        } catch (cause) {
          send(response, 500, { error: 'inject', detail: String(cause) });
        } finally {
          try {
            if (observed && typeof observed[Symbol.dispose] === 'function') observed[Symbol.dispose]();
            else if (observed && typeof observed.dispose === 'function') observed.dispose();
          } catch { /* release is best effort */ }
        }
      },
    }), 'dsh-side-chat: context route');
  });
}
