/**
 * dsh-side-chat — a clean conversation beside the main one.
 *
 * Entry lives on the right Sidebar's guide page. Picking it opens a Side Chat
 * tab; the tab body creates a brand-new blank Session, binds it, and renders the
 * shared Conversation factory. The Host injects the main conversation as a
 * hidden context message, so the panel stays clean while the model can read the
 * main line. Closing the tab archives the Session.
 *
 * Selection overlay: selecting transcript text offers "ask in side chat", which
 * creates a side conversation and sends the cited passage (with its event seq)
 * plus the typed question.
 */
window.__ModuleLoader__.load({
  id: 'dsh-side-chat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    const PLUGIN_ID = 'dsh-side-chat';
    const TAB_KIND = 'sidechat';
    const CONVERSATION_SLOT = 'dsh-side-chat.conversation';
    const SOURCE = 'sideChat';
    const NS = 'sideChat';

    const zh = {
      'guide.title': '侧边聊天',
      'guide.description': '在主对话旁边开一个临时会话；关闭即归档',
      'tab.title': '侧边聊天',
      'panel.noTarget': '这个侧边聊天没有可显示的会话。',
      'panel.unsupported': '当前界面缺少会话渲染能力，无法显示侧边聊天。',
      'panel.loading': '正在打开侧边会话…',
      'panel.failed': '创建侧边会话失败。',
      'ask.add': '添加到对话',
      'ask.button': '在侧边聊天中提问',
      'ask.placeholder': '就这段内容提个问题，回车发送',
      'ask.send': '发送',
      'ask.cancel': '取消',
      'ask.working': '发送中…',
      'ask.failed': '发送失败',
      'cite.label': '引用 · 事件',
      'cite.labelUnknown': '引用 · 事件未知',
      'cite.bodyMissing': '原文见主对话，点开事件编号可查',
      'keep.do': '保留为正式对话',
      'keep.undo': '取消保留',
      'keep.note': '关闭标签后仍留在会话列表',
      'keep.on': '已保留为正式对话',
      'keep.off': '保留为正式对话',
    };
    const en = {
      'guide.title': 'Side chat',
      'guide.description': 'A temporary conversation beside the main one; closing archives it',
      'tab.title': 'Side chat',
      'panel.noTarget': 'This side chat has no conversation to show.',
      'panel.unsupported': 'This UI does not expose the conversation renderer.',
      'panel.loading': 'Opening the side conversation…',
      'panel.failed': 'Could not create the side conversation.',
      'ask.add': 'Add to conversation',
      'ask.button': 'Ask in side chat',
      'ask.placeholder': 'Ask about this passage, Enter to send',
      'ask.send': 'Send',
      'ask.cancel': 'Cancel',
      'ask.working': 'Sending…',
      'ask.failed': 'Could not send',
      'cite.label': 'Quote · event',
      'cite.labelUnknown': 'Quote · event unknown',
      'cite.bodyMissing': 'The passage lives in the main conversation',
      'keep.do': 'Keep as a regular conversation',
      'keep.undo': 'Stop keeping',
      'keep.note': 'Stays in the session list after closing',
      'keep.on': 'Kept as a regular conversation',
      'keep.off': 'Keep as a regular conversation',
    };

    const CSS = [
      '.dsh-sidechat-panel{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
      '.dsh-sidechat-keep{position:absolute;top:8px;right:8px;z-index:10;display:inline-flex;align-items:center;',
      'justify-content:center;width:24px;height:24px;padding:0;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);cursor:pointer;',
      'opacity:.72;transition:opacity 120ms ease,color 120ms ease,border-color 120ms ease}',
      '.dsh-sidechat-keep:hover{opacity:1;border-color:var(--dsw-alias-border-l2)}',
      '.dsh-sidechat-keep[data-kept=true]{color:var(--dsw-alias-brand-primary);opacity:1}',
      '.dsh-sidechat-panel>*{flex:1 1 auto;min-height:0}',
      '.dsh-sidechat-note{padding:16px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}',
      '.dsh-sidechat-ask{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:6px;',
      'padding:4px;border-radius:10px;background:var(--dsw-alias-bg-overlay);',
      'border:1px solid var(--dsw-alias-border-l1);box-shadow:0 8px 24px rgb(0 0 0 / 24%);}',
      '.dsh-sidechat-ask-row{display:flex;align-items:center;gap:4px}',
      '.dsh-sidechat-ask button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;',
      'border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}',
      '.dsh-sidechat-ask button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
      '.dsh-sidechat-ask button:disabled{opacity:.5;cursor:progress}',
      '.dsh-sidechat-ask input{width:280px;height:28px;padding:0 8px;border-radius:7px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.dsh-sidechat-ask input:focus{border-color:var(--dsw-alias-brand-primary)}',
    ].join('');

    function GuideIcon({ size }) {
      const px = typeof size === 'number' ? size : 16;
      return h('svg', {
        viewBox: '0 0 64 64', width: px, height: px, fill: 'none', 'aria-hidden': true,
      },
        h('rect', { x: 6, y: 10, width: 30, height: 22, rx: 6, stroke: 'currentColor', strokeWidth: 5 }),
        h('path', { d: 'M14 32v7l8-7', stroke: 'currentColor', strokeWidth: 5, strokeLinejoin: 'round' }),
        h('rect', { x: 28, y: 28, width: 30, height: 22, rx: 6, stroke: 'currentColor', strokeWidth: 5 }),
        h('path', { d: 'M50 50v7l-8-7', stroke: 'currentColor', strokeWidth: 5, strokeLinejoin: 'round' }),
      );
    }

    const CITE_ID = 'sideChatCite';
    const CITE_HEAD = '〔引自主对话';
    const CITE_END = '〔/引用〕';

    /** Match one whole citation block so the transcript can render it as a chip. */
    const sideChatCiteRule = {
      id: CITE_ID,
      order: 50,
      match(text, from) {
        const start = text.indexOf(CITE_HEAD, from);
        if (start < 0) return undefined;
        const headEnd = text.indexOf('〕', start);
        if (headEnd < 0) return undefined;
        const head = text.slice(start + 1, headEnd);
        const sessionMatch = /session-[0-9a-zA-Z-]+/.exec(head);
        const seqMatch = /事件\s*(\d+)/.exec(head);
        const after = text.slice(headEnd + 1);
        const closeAt = after.indexOf(CITE_END);
        const nextOpenAt = after.indexOf(CITE_HEAD);
        const hasBody = closeAt >= 0 && (nextOpenAt < 0 || closeAt < nextOpenAt);
        const end = hasBody ? headEnd + 1 + closeAt + CITE_END.length : headEnd + 1;
        const body = hasBody ? text.slice(headEnd + 1, headEnd + 1 + closeAt).trim() : '';
        return {
          id: CITE_ID,
          start,
          end,
          data: {
            sessionId: sessionMatch ? sessionMatch[0] : 'unknown',
            seq: seqMatch ? Number(seqMatch[1]) : null,
            body: body.slice(0, 4000),
          },
        };
      },
    };

    /**
     * Compact chip standing in for the citation block. Clicking toggles the
     * cited passage in a bordered box, so it stays visually separate from the
     * user's own prompt while remaining readable on demand.
     */
    function CiteChip({ node, raw, t }) {
      const [open, setOpen] = useState(false);
      const [passage, setPassage] = useState(null);
      const [loading, setLoading] = useState(false);
      const data = (node && node.data) || {};
      const label = data.seq === null || data.seq === undefined
        ? t('cite.labelUnknown')
        : t('cite.label') + ' ' + String(data.seq);
      const body = data.body ? String(data.body) : '';
      const hasSeq = typeof data.seq === 'number';
      const canExpand = body.length > 0 || hasSeq;
      const shown = body.length > 0 ? body : (passage === null ? '' : passage);
      const toggle = async () => {
        if (!canExpand) return;
        if (open) {
          setOpen(false);
          return;
        }
        if (body.length > 0) {
          setOpen(true);
          return;
        }
        setLoading(true);
        try {
          const query = '?sessionId=' + encodeURIComponent(String(data.sessionId || '')) + '&seq=' + String(data.seq);
          const response = await fetch('/sidechat/event' + query);
          const payload = await response.json();
          setPassage(payload && typeof payload.text === 'string' ? payload.text : '');
        } catch (cause) {
          console.warn('[side-chat] read event failed', cause);
          setPassage('');
        } finally {
          setLoading(false);
          setOpen(true);
        }
      };
      return h('span', {
        style: {
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          verticalAlign: 'top',
          maxWidth: '100%',
        },
      },
        h('button', {
          type: 'button',
          title: body.length > 0 && !open ? body : '',
          'aria-expanded': open,
          disabled: !canExpand,
          onClick: () => { void toggle(); },
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '1px 7px',
            borderRadius: '6px',
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-2)',
            color: 'var(--dsw-alias-label-secondary)',
            font: 'inherit',
            fontSize: '12px',
            lineHeight: '18px',
            cursor: canExpand ? 'pointer' : 'default',
            userSelect: 'none',
          },
        }, label, canExpand ? h('span', { 'aria-hidden': true, style: { opacity: 0.7 } }, open ? '▾' : '▸') : null),
        open
          ? h('span', {
            style: {
              display: 'block',
              marginTop: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-layer-1)',
              color: 'var(--dsw-alias-label-primary)',
              fontSize: '12px',
              lineHeight: '1.65',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '240px',
              overflow: 'auto',
              maxWidth: '100%',
            },
          }, loading ? '…' : (shown.length > 0 ? shown : t('cite.bodyMissing')))
          : null,
      );
    }

    function SideChatStyle() {
      return h('style', { 'data-dsh-side-chat': '' }, CSS);
    }

    /** Client context captured by the components' async paths. */
    let ctxRef = null;

    /** Session created for a tab that opened without navigation params. */
    const createdByTab = new Map();

    /** Side Sessions promoted to regular conversations; closing must not archive them. */
    const KEEP_STORAGE_KEY = 'dsh-side-chat:kept';
    const keptSessions = new Set();
    try {
      const raw = localStorage.getItem(KEEP_STORAGE_KEY);
      if (raw) {
        for (const id of JSON.parse(raw)) keptSessions.add(id);
      }
    } catch { /* storage is optional */ }
    function persistKept() {
      try {
        localStorage.setItem(KEEP_STORAGE_KEY, JSON.stringify([...keptSessions]));
      } catch { /* storage is optional */ }
    }


    /** On-screen main Session and its Chat node reader, for locating citations. */
    const mainContext = { sessionId: null, actions: null, readSeq: null, draft: '' };

    /** Hand the main conversation to the side chat as hidden Host-injected context. */
    async function injectContext(childSessionId, parentSessionId, attempt = 0) {
      try {
        const response = await fetch('/sidechat/inject', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ childSessionId, parentSessionId }),
        });
        if (response.ok) return;
        if (response.status === 409 && attempt < 4) {
          setTimeout(() => { void injectContext(childSessionId, parentSessionId, attempt + 1); }, 600);
          return;
        }
        console.warn('[side-chat] context inject rejected', response.status);
      } catch (cause) {
        console.warn('[side-chat] context inject failed', cause);
      }
    }

    /** Create one side Session: a parent-bearing fork with no copied messages. */
    async function createSideSession(parentSessionId) {
      const ctx = ctxRef;
      let cwd;
      try {
        const state = ctx.sessions.list.getSnapshot();
        const summary = state && state.byId ? state.byId[parentSessionId] : undefined;
        cwd = summary ? summary.cwd : undefined;
      } catch {
        cwd = undefined;
      }
      try {
        return await ctx.sessions.fork({ sessionId: parentSessionId, atSeq: 0, increaseTitle: true });
      } catch {
        return await ctx.sessions.create(cwd !== undefined ? { cwd } : {});
      }
    }

    /** One-line citation: the event marker plus the selected passage, no extra lines. */
    function buildCitationShort(sessionId, seq, text) {
      const where = seq === undefined ? '事件未知' : '事件 ' + String(seq);
      return '〔引自主对话 · ' + sessionId + ' · ' + where + '〕「' + text + '」〔/引用〕';
    }

    /** Citation block carrying the source event number the model can re-read. */
    function buildCitation(text, sessionId, seq) {
      const where = seq === undefined ? '事件未知' : '事件 ' + String(seq);
      return '〔引自主对话 · ' + sessionId + ' · ' + where + '〕\n' + text + '\n〔/引用〕';
    }

    /** Send one prompt into a live side Session through the Host route. */
    async function sendSidePrompt(childSessionId, text, attempt = 0) {
      const response = await fetch('/sidechat/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ childSessionId, text }),
      });
      if (response.ok) return;
      if (response.status === 409 && attempt < 8) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return sendSidePrompt(childSessionId, text, attempt + 1);
      }
      let detail = '';
      try {
        const body = await response.json();
        detail = body && body.detail ? String(body.detail) : body && body.error ? String(body.error) : '';
      } catch {
        detail = '';
      }
      throw new Error('ask ' + response.status + (detail ? ': ' + detail : ''));
    }

    /** The most recently opened side conversation, with the tab that hosts it. */
    function latestSideSession() {
      let latest;
      for (const [tabId, childId] of createdByTab) {
        if (childId && childId !== '__failed__') latest = { tabId, childId };
      }
      return latest;
    }

    /**
     * Send the citation plus question into the open side chat when one exists;
     * otherwise create a side Session first. Reusing keeps one side conversation
     * per main conversation instead of a new tab per question.
     */
    async function askInSideChat(parentSessionId, citation, question) {
      const ctx = ctxRef;
      const existing = latestSideSession();
      if (existing !== undefined) {
        try {
          ctx.sidebarRight.focus(existing.tabId);
        } catch (cause) {
          console.warn('[side-chat] focus existing failed', cause);
        }
        await sendSidePrompt(existing.childId, citation + '\n\n' + question);
        return existing.childId;
      }
      const childSessionId = await createSideSession(parentSessionId);
      try {
        await ctx.sessions.using(childSessionId, { source: SOURCE }, async () => {});
      } catch (cause) {
        console.warn('[side-chat] warm open failed', cause);
      }
      void injectContext(childSessionId, parentSessionId);
      ctx.sidebarRight.openTab(TAB_KIND, { params: { childSessionId, parentSessionId } });
      await sendSidePrompt(childSessionId, citation + '\n\n' + question);
      return childSessionId;
    }

    /**
     * Invisible composer-row seat. Records the on-screen main Session and a
     * reader that maps a DOM node key back to its event sequence number, so the
     * root-scoped overlay can cite the exact source event.
     */
    function InputBridge({ sessionId, inputActions, useSessions, useChat, useInput }) {
      // A side Session is one this plugin created; anything else is the main
      // conversation, even when it was itself forked from another Session.
      let isMain = true;
      for (const childId of createdByTab.values()) {
        if (childId === sessionId) {
          isMain = false;
          break;
        }
      }
      const snapshot = useChat((value) => value);
      const input = useInput((value) => value);
      const draft = input && typeof input.draft === 'string' ? input.draft : '';
      useEffect(() => {
        if (!isMain || !sessionId) return undefined;
        mainContext.sessionId = sessionId;
        mainContext.actions = inputActions || null;
        mainContext.draft = draft;
        mainContext.readSeq = (key) => {
          try {
            const nodes = snapshot && snapshot.nodes;
            const node = nodes && typeof nodes.get === 'function' ? nodes.get(key) : undefined;
            return node && typeof node.anchorSeq === 'number' ? node.anchorSeq : undefined;
          } catch {
            return undefined;
          }
        };
        return () => {
          if (mainContext.sessionId === sessionId) {
            mainContext.sessionId = null;
            mainContext.actions = null;
            mainContext.readSeq = null;
            mainContext.draft = '';
          }
        };
      }, [isMain, sessionId, inputActions, snapshot, draft]);
      return null;
    }

    /** Selection-anchored menu: ask the side chat about the selected passage. */
    function SelectionOverlay({ t }) {
      const [popover, setPopover] = useState(null);
      const [asking, setAsking] = useState(false);
      const [question, setQuestion] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const rootRef = useRef(null);
      const inputRef = useRef(null);

      const close = useCallback(() => {
        setPopover(null);
        setAsking(false);
        setQuestion('');
        setError('');
        setBusy(false);
      }, []);

      useEffect(() => {
        const onSelect = () => {
          if (asking) return;
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) return;
          const text = selection.toString().trim();
          if (!text) return;
          let range;
          try {
            range = selection.getRangeAt(0);
          } catch {
            return;
          }
          const container = range.commonAncestorContainer;
          const element = container.nodeType === 1 ? container : container.parentElement;
          if (!element) return;
          if (!element.closest('[data-slot="conversation.chat.flow"], [data-chat-flow], [data-conversation-scroll]')) return;
          if (element.closest('input, textarea, [contenteditable="true"]')) return;
          let seq;
          try {
            const row = element.closest('[data-chat-node-key]');
            const key = row ? row.getAttribute('data-chat-node-key') : null;
            seq = key && mainContext.readSeq ? mainContext.readSeq(key) : undefined;
          } catch {
            seq = undefined;
          }
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          setPopover({
            text,
            seq,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
            top: Math.min(rect.bottom + 8, window.innerHeight - 90),
            sessionId: mainContext.sessionId,
          });
          setAsking(false);
          setError('');
        };
        const onDown = (event) => {
          if (rootRef.current && rootRef.current.contains(event.target)) return;
          if (asking) return;
          close();
        };
        const onKey = (event) => {
          if (event.key === 'Escape') close();
        };
        document.addEventListener('mouseup', onSelect);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('mouseup', onSelect);
          document.removeEventListener('mousedown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [asking, close]);

      useEffect(() => {
        if (asking && inputRef.current) {
          try { inputRef.current.focus(); } catch { /* focus is best effort */ }
        }
      }, [asking]);

      if (!popover) return null;
      const sessionId = popover.sessionId || mainContext.sessionId;
      const addToConversation = () => {
        const actions = mainContext.actions;
        if (!actions || !sessionId) return;
        const citation = buildCitationShort(sessionId, popover.seq, popover.text) + '\n\n';
        try {
          const span = actions.captureInsertion();
          if (!actions.insertText(citation, span)) {
            actions.setDraft(citation + (mainContext.draft || ''));
          }
        } catch (cause) {
          console.warn('[side-chat] cite failed', cause);
        }
        close();
      };
      const send = async () => {
        const text = question.trim();
        if (!text || !sessionId || busy) return;
        setBusy(true);
        setError('');
        try {
          await askInSideChat(sessionId, buildCitation(popover.text, sessionId, popover.seq), text);
          close();
        } catch (cause) {
          console.warn('[side-chat] ask failed', cause);
          const detail = cause && cause.message ? String(cause.message) : String(cause);
          setError(t('ask.failed') + '：' + detail.slice(0, 80));
          setBusy(false);
        }
      };

      return h('div', {
        ref: rootRef,
        className: 'dsh-sidechat-ask',
        style: { left: popover.left + 'px', top: popover.top + 'px' },
      },
        h(SideChatStyle),
        h('div', { className: 'dsh-sidechat-ask-row' },
          asking
            ? [
              h('input', {
                key: 'input',
                ref: inputRef,
                value: question,
                placeholder: error || t('ask.placeholder'),
                disabled: busy,
                onChange: (event) => setQuestion(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                },
              }),
              h('button', {
                key: 'send',
                type: 'button',
                disabled: busy || question.trim().length === 0,
                onMouseDown: (event) => event.preventDefault(),
                onClick: () => void send(),
              }, busy ? t('ask.working') : t('ask.send')),
              h('button', {
                key: 'cancel',
                type: 'button',
                disabled: busy,
                onMouseDown: (event) => event.preventDefault(),
                onClick: close,
              }, t('ask.cancel')),
            ]
            : [
              h('button', {
                key: 'add',
                type: 'button',
                disabled: !sessionId || !mainContext.actions,
                onMouseDown: (event) => event.preventDefault(),
                onClick: addToConversation,
              }, t('ask.add')),
              h('button', {
                key: 'ask',
                type: 'button',
                disabled: !sessionId,
                onMouseDown: (event) => event.preventDefault(),
                onClick: () => setAsking(true),
              }, t('ask.button')),
            ]),
      );
    }

    /** One tab's Session: given by navigation params, or created on first open. */
    function useSideSession(parentSessionId, tabId, provided) {
      const [childId, setChildId] = useState(provided || null);
      const creating = useRef(false);

      useEffect(() => {
        if (provided) {
          createdByTab.set(tabId, provided);
          setChildId(provided);
          return undefined;
        }
        if (creating.current) return undefined;
        creating.current = true;
        let cancelled = false;
        Promise.resolve()
          .then(() => createSideSession(parentSessionId))
          .then((id) => {
            if (cancelled) return;
            createdByTab.set(tabId, id);
            setChildId(id);
            void injectContext(id, parentSessionId);
          })
          .catch((cause) => {
            console.warn('[side-chat] create failed', cause);
            if (!cancelled) setChildId('__failed__');
          });
        return () => { cancelled = true; };
      }, [parentSessionId, tabId, provided]);

      return childId;
    }

    /** Tab body: resolve the Session, retain it, then hand it to the conversation seat. */
    function SideChatTab(props) {
      const { sessionId: parentSessionId, useTabInfo, SessionProvider, renderSlot, t } = props;
      const tabInfo = typeof useTabInfo === 'function' ? useTabInfo() : undefined;
      const tab = tabInfo && tabInfo.tab ? tabInfo.tab : undefined;
      const params = tab && tab.navigation ? tab.navigation.params : undefined;
      const provided = params && params.childSessionId ? params.childSessionId : null;
      const childId = useSideSession(parentSessionId, tab ? tab.id : 'unknown', provided);
      const [reference, setReference] = useState(null);
      const [kept, setKept] = useState(() => Boolean(childId && keptSessions.has(childId)));
      useEffect(() => {
        setKept(Boolean(childId && keptSessions.has(childId)));
      }, [childId]);
      const toggleKeep = () => {
        if (!childId || childId === '__failed__') return;
        if (keptSessions.has(childId)) keptSessions.delete(childId);
        else keptSessions.add(childId);
        persistKept();
        setKept((value) => !value);
      };

      useEffect(() => {
        if (!childId || childId === '__failed__') return undefined;
        let retained;
        try {
          retained = ctxRef.sessions.retain(childId, { source: SOURCE });
        } catch (cause) {
          console.warn('[side-chat] retain failed', cause);
          return undefined;
        }
        setReference(retained);
        return () => {
          setReference(null);
          retained.release();
        };
      }, [childId]);

      if (childId === '__failed__') {
        return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
          h('div', { className: 'dsh-sidechat-note' }, t('panel.failed')));
      }
      if (!reference) {
        return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
          h('div', { className: 'dsh-sidechat-note' }, t('panel.loading')));
      }
      if (typeof SessionProvider !== 'function' || typeof renderSlot !== 'function') {
        return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
          h('div', { className: 'dsh-sidechat-note' }, t('panel.unsupported')));
      }
      return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
        h('button', {
          type: 'button',
          className: 'dsh-sidechat-keep',
          'data-kept': kept ? 'true' : 'false',
          title: kept ? t('keep.on') : t('keep.off'),
          'aria-label': kept ? t('keep.on') : t('keep.off'),
          'aria-pressed': kept,
          onClick: toggleKeep,
        }, h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', 'aria-hidden': true },
          kept
            ? h('path', { d: 'M8 1.5 9.6 5.4l4.1.3-3.1 2.7 1 4-3.6-2.2-3.6 2.2 1-4L2.3 5.7l4.1-.3z', fill: 'currentColor' })
            : h('path', { d: 'M8 1.5 9.6 5.4l4.1.3-3.1 2.7 1 4-3.6-2.2-3.6 2.2 1-4L2.3 5.7l4.1-.3z', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }))),
        h(SessionProvider, { session: reference }, renderSlot(CONVERSATION_SLOT, {})));
    }

    /** Inner seat: render the shared Conversation factory at the Session's real phase. */
    function SideChatConversation({ renderFactorySlot, useSession, t }) {
      if (typeof renderFactorySlot !== 'function') {
        return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
          h('div', { className: 'dsh-sidechat-note' }, t('panel.unsupported')));
      }
      let session;
      try {
        session = typeof useSession === 'function' ? useSession((value) => value) : undefined;
      } catch {
        session = undefined;
      }
      const blank = !session || session.blank === true || session.awaitingFirstTurn === true;
      const loading = session && session.openState === 'loading';
      const phase = loading && blank ? 'settling' : blank ? 'hero' : 'active';
      return h('div', { className: 'dsh-sidechat-panel' }, h(SideChatStyle),
        renderFactorySlot('conversation.content', {
          variant: 'embedded',
          phase,
          hero: phase === 'hero',
        }));
    }

    return {
      inject: ['slots', 'sessions', 'sidebarRight', 'sidebarRightTabs', 'uiWorkspace', 'locale', 'remote', 'uiConversation'],
      apply(ctx) {
        ctxRef = ctx;
        const disposeLocale = ctx.locale.register(NS, { zh, en });
        const t = ctx.locale.bind(NS);

        const disposeType = ctx.sidebarRightTabs.register({
          id: PLUGIN_ID,
          kind: TAB_KIND,
          priority: 'extension',
          multiple: true,
          title: () => t('tab.title'),
          guide: [{
            id: PLUGIN_ID,
            order: 50,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: GuideIcon,
          }],
        });

        const disposeBody = ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: PLUGIN_ID,
          children: { [CONVERSATION_SLOT]: { kind: 'single', scope: 'session' } },
        }, (props) => h(SideChatTab, { ...props, t })));

        const disposeConversation = ctx.slots.inject(CONVERSATION_SLOT, () => ctx.slots.register({
          name: CONVERSATION_SLOT,
        }, (props) => h(SideChatConversation, { ...props, t })));

        const disposeBridge = ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: PLUGIN_ID + '-bridge',
          order: 999,
        }, (props) => h(InputBridge, { ...props })));

        const disposeRule = ctx.uiConversation.userText.register(sideChatCiteRule);



        const disposeCiteNode = ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({
          name: 'conversation.user.text.node',
          key: CITE_ID,
          priority: 100,
        }, (props) => h(CiteChip, { ...props, t })));

        const disposeOverlay = ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: PLUGIN_ID + '-ask',
          order: 100,
        }, () => h(SelectionOverlay, { t })));

        const disposeClose = ctx.sidebarRight.registerCloseHandler(TAB_KIND, (sessionId, tab) => {
          const params = tab && tab.navigation ? tab.navigation.params : undefined;
          const fromParams = params && params.childSessionId ? params.childSessionId : undefined;
          const childSessionId = fromParams || (createdByTab.get(tab.id) ?? undefined);
          createdByTab.delete(tab.id);
          if (!childSessionId) return;
          if (keptSessions.has(childSessionId)) {
            keptSessions.delete(childSessionId);
            persistKept();
            return;
          }
          Promise.resolve()
            .then(() => ctx.uiWorkspace.archiveSession(childSessionId, { stopActivity: true }))
            .catch((cause) => console.warn('[side-chat] archive failed', cause));
        });

        ctx.effect(() => () => {
          disposeClose();
          disposeKeepItem();
          disposeCiteNode();
          disposeRule();
          disposeOverlay();
          disposeBridge();
          disposeConversation();
          disposeBody();
          disposeType();
          disposeLocale();
        }, 'dsh-side-chat: registrations');
      },
    };
  },
});
