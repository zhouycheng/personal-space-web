# 源码备注

监控有意保持单向：

```text
本地 macOS 脚本 -> Astro API -> 服务端内存存储 -> 浏览器 SSE 徽章
```

浏览器无法控制本地 Mac。它只接收最新快照。

需要保留的重要行为：

- 要求 `ACTIVITY_MONITOR_TOKEN`，
- 在不活跃/未知应用时清除状态，
- 保持 TTL 使过期状态消失，
- 避免保存历史记录，
- 保持应用名称到显示文案的映射在 `runtime/catalog.ts` 中。

当前 Astro 实现：

- `scripts/activity-monitor.mjs` 加载 `.env.local` 或 `.env`，使用 `/usr/bin/osascript` 读取前台应用，并发送 Bearer Token 更新。
- `runtime/astro-update.ts` 在更新内存存储前验证 token 和载荷。
- `runtime/store.ts` 仅保留最新支持的应用快照，并在 `25000` ms 后过期。
- `runtime/astro-stream.ts` 通过 SSE 流式推送快照，每 `15000` ms 发送心跳注释。
- `local-activity-status.ts` 使用 `EventSource` 订阅并在浏览器中更新徽章状态。

浏览器仍然无法控制本地 Mac。它只接收最近支持的前台应用的净化快照。
