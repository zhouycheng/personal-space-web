# 本地活动状态

分类：`JS Motion`

状态：Astro 提取完成。Astro API 路由已在此项目中接入；徽章组件已可用，但尚未挂载到当前启动页。

此组件保留了旧首页的本地前台应用监控功能，并将整个运行时保留在此 Justin Kit 文件夹内。

## 文件

- `LocalActivityStatus.astro` 渲染实时徽章。
- `local-activity-status.css` 包含徽章状态和布局。
- `local-activity-status.ts` 使用 `EventSource` 监听 SSE。
- `runtime/types.ts` 定义传输载荷和快照形态。
- `runtime/catalog.ts` 将 macOS 应用名称映射为显示文字。
- `runtime/store.ts` 以 TTL 保持内存中的状态。
- `runtime/astro-update.ts` 导出 Astro `POST` 路由。
- `runtime/astro-stream.ts` 导出 Astro SSE `GET` 路由。
- `scripts/activity-monitor.mjs` 使用 `osascript` 轮询 macOS 前台应用。
- `source-notes.md` 记录提取时参考的旧 Next 源文件。

## Astro 路由

项目路由文件有意从此组件重新导出运行时：

```ts
export { POST, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-update";
export { GET, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-stream";
```

## 用法

```astro
---
import LocalActivityStatus from "./LocalActivityStatus.astro";
---

<LocalActivityStatus />
```

## 运行时

从 `.env.example` 创建 `.env.local`，或在启动站点和监控之前导出以下变量：

```bash
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:4321
ACTIVITY_MONITOR_POLL_INTERVAL_MS=2000
ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS=12000
ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS=4000
```

在两个终端中分别运行站点和监听器：

```bash
npm run dev
npm run monitor:activity
```

数据流为：

```text
macOS 前台应用 -> POST /api/activity/update -> 内存 TTL 存储 -> SSE /api/activity/stream -> LocalActivityStatus
```

监控仅限 macOS，因为它依赖 `osascript` 和 System Events。如果某个应用未显示，请将其名称或别名添加到 `runtime/catalog.ts`。

## API 契约

`POST /api/activity/update` 接受 JSON：

```json
{
  "appName": "Cursor",
  "state": "active",
  "observedAt": 1760000000000,
  "sessionId": "optional-session-id"
}
```

需要鉴权。监控发送：

```text
Authorization: Bearer <ACTIVITY_MONITOR_TOKEN>
```

该路由也接受 `x-activity-token` 以兼容简单的本地客户端。

`GET /api/activity/stream` 返回服务端推送事件。每条消息要么是活动快照，要么在状态为空闲、过期、不活跃或未知时为 `null`。

## 时序

- 监控轮询间隔：`ACTIVITY_MONITOR_POLL_INTERVAL_MS`，默认 `2000`。
- 监控心跳发送间隔：`ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS`，默认 `12000`。
- 监控请求超时：`ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS`，默认 `4000`。
- 服务端状态 TTL：`25000` ms。
- SSE 心跳间隔：`15000` ms。

## 集成检查清单

- 从仓库根目录同时运行 `npm run dev` 和 `npm run monitor:activity`。
- 确保 Astro 服务器和监控脚本能读取到相同的 token。
- 如果 `osascript` 无法读取 System Events，请授予终端应用 macOS 辅助功能权限。
- 在期望新应用名称出现在徽章中之前，先将其添加到 `runtime/catalog.ts`。
