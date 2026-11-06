# dsh-side-chat

给 DeepSeek Harness（DSH）的 Web 界面加一个并排的**侧边聊天**。

主对话在左边照常进行，侧边聊天在右栏开一个临时会话。它读得到主对话的上下文，但界面里不显示主对话——干净、隔离、关掉即忘。

> 实验性插件。仅在 DSH `0.2.1-rc.2` 上验证过，见文末「兼容性与风险」。

## 功能

| 功能 | 说明 |
|---|---|
| 并排侧边聊天 | 右栏「开始」页的「侧边聊天」卡片，开一个临时会话 |
| 读取主对话 | 主对话以不可见上下文注入侧边会话，面板只显示侧边自己的对话 |
| 引用提问 | 选中主对话原文 → 浮层「在侧边聊天中提问」，引用带事件号 |
| 添加到对话 | 选中原文 → 「添加到对话」，单行引用插入当前输入框 |
| 引用 chip | 引用在消息里折叠成「引用 · 事件 N」，点开看选中片段 |
| 临时性 | 关闭侧边聊天标签即归档该会话，不留在会话列表 |

## 安装

插件是**本地目录 bundle**，不需要构建，也没有 npm 依赖。

### 方式 A：让 DSH agent 安装（推荐）

```sh
git clone <this-repo> ~/dsh-plugins/dsh-side-chat
```

然后在 DSH 会话里说：「安装 `~/dsh-plugins/dsh-side-chat` 这个插件」。
agent 会用 plugin manager 链接目录、加入 profile bundles，并立即生效。

### 方式 B：手动

```sh
dsh plugin --profile web add /path/to/dsh-side-chat
```

然后把包名加入 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-side-chat"]
    }
  }
}
```

重启 DSH web，刷新页面。

### 验证

- 右栏「开始」页出现「侧边聊天」卡片
- 选中对话正文 → 浮动菜单出现「添加到对话 / 在侧边聊天中提问」

## 使用

**开一个侧边聊天**：右栏「开始」页 → 点「侧边聊天」→ 面板里直接打字。

**带原文提问**：在主对话里选中一段文字 → 点「在侧边聊天中提问」→ 写下问题 → 回车。
侧边聊天里会收到：

```
〔引自主对话 · session-xxx · 事件 N〕「选中的片段」〔/引用〕

你的问题
```

**把引用加进当前输入框**：选中文字 → 点「添加到对话」→ 输入框出现一行引用 → 接着写问题并发送。

**关闭即归档**：关掉侧边聊天的标签，那个会话被归档，不留在会话列表里。下次再开是新的会话。

## 工作原理

- **入口**：Client 插件在右栏引导页注册一个 tab 类型 + 一张卡片。
- **会话**：用 `sessions.fork({ atSeq: 0 })` 建一个带 parent、但没有复制消息的会话——因此不会出现工作区选择器，面板是空白的。
- **上下文**：Host 半注册 `POST /sidechat/inject`，用 `agent.inject()` 写一条 `source.kind` 非 `user` 的用户消息。DSH 的 Chat 会隐藏普通 context 行，模型照常读到。
- **提问**：`POST /sidechat/ask` 直接调 `agent.followup()`，避免依赖 remote 通道。
- **引用定位**：选区所在的 DOM 节点带 `data-chat-node-key`，经 Chat store 反查 `anchorSeq`；`GET /sidechat/event` 按事件号读原文。
- **渲染**：注册 `sideChatCite` 用户文本节点规则，把引用块折叠成 chip。

## 兼容性与风险

- 仅在 DSH `0.2.1-rc.2` 验证。DSH 仍处 rc 阶段，slot 名、Client 服务、Host 服务都可能变动。
- 使用了 `agent.followup()` 这类半公开的 Host API，升级后可能需要跟着改。
- 三条本地 HTTP 路由（`/sidechat/inject`、`/sidechat/ask`、`/sidechat/event`）绑定在 loopback 上，**没有额外认证**。仅供本机单人使用，不要把 DSH 暴露到公网。
- 功能依赖 DSH 的 fork 语义（`atSeq: 0`）与 `conversation.user.text.node` 扩展点。
- 侧边会话是主会话的 fork，主会话被删除或归档后，侧边会话可能失去父引用。

## License

MIT
