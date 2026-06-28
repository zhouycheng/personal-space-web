# 当前工作

## 当前焦点

JustinWeb 聚焦于基于 Astro 的 Justin OS 路由外壳、首页状态过渡、Justin Kit 组件提取以及基于 ReactFlow 的画布编辑系统。

## 活跃界面

- `src/pages/index.astro`：`/` 首页别名，渲染共享应用外壳。
- `src/pages/home.astro`、`src/pages/works.astro`、`src/pages/os.astro`：Dock 路由入口。
- `src/components/app/JustinAppShell.astro`：共享路由外壳、启动状态机、History API 导航、Justin OS 投影、个人画布和顶部菜单事件。
- `src/components/app/homeRuntimeState.mjs`：终端时序缩放和同标签页首页过渡快照辅助。
- `src/styles/global.css`：全局布局、启动屏幕动效、Dock 导航、个人画布、响应式规则和 OS 投影样式。
- `src/justin-kit/components/macos-desktop/`：可复用的 macOS 风格桌面和窗口系统。
- `public/os-desktop/`：文件驱动的 Justin OS 桌面内容。
- `src/justin-kit/components/local-activity-status/`：本地活动运行时和监控。
- `src/components/mine-canvas/`：ReactFlow 画布编辑器、七种卡片类型和内联编辑；首次进入 `/os` 时才加载。
- `src/server/canvas/`：不可变 SQLite revision、作者会话和内容寻址图片资源。
- `ops/backup/`：每小时 SQLite 一致性快照、本机 Restic 与 S3 异地备份。

## 验证基线

- `rtk npm run build`。
- `rtk node --test tests/*.test.mjs`（App 外壳辅助逻辑）。
- 交互密集的变更需要浏览器预览，包括直接刷新 `/`、`/home`、`/works` 和 `/os`。
- 本地活动变更需要环境和路由检查。

## 当前风险

- 首页和 Justin OS 过渡交互密集，需要在桌面和窄屏幕上进行视觉 QA。
- 路由外壳变更需要后退/前进和刷新检查，因为首页状态有意在当前浏览器标签页会话中保留。
- `public/os-desktop/` 内容在构建时扫描，重命名文件需要页面刷新或重新构建。
- 画布实时编辑通过单通道保存队列写入不可变 revision；需要持续验证离线重试和 `409` 冲突状态。
- Docker 生产运行时必须从 `dist/client/os-desktop` 扫描桌面内容；健康检查会阻止空桌面部署被视为正常。
