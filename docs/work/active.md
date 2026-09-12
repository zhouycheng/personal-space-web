# 当前工作

## 当前焦点

三维工作室首页连接 Justin OS、作品集与 ReactFlow 画布，提供物件交互、本地时间光照和可访问的内容入口。

## 活跃界面

- `src/pages/index.astro`：`/` 首页别名，渲染共享应用外壳。
- `src/pages/home.astro`、`src/pages/works.astro`、`src/pages/os.astro`：Dock 路由入口。
- `src/components/app/JustinAppShell.astro`：共享路由外壳与工作室、OS、作品集、个人画布挂载点。
- `src/components/app/studioAppRuntime.ts`：History API 导航、面板、稳定态会话恢复、房间与桌面生命周期协调。
- `src/components/studio/`：程序化 Three.js 房间、五个内容入口、转椅动画、原生 HTML 面板、键盘/失败替代入口及本地时间光照插值。
- `src/components/app/homeRuntimeState.mjs`：保留的旧终端辅助，不再用于首页。
- `src/styles/global.css`：全局布局、启动屏幕动效、Dock 导航、个人画布、响应式规则和 OS 投影样式。
- `src/justin-kit/components/macos-desktop/`：可复用的 macOS 风格桌面和窗口系统。
- `src/justin-kit/components/symbol-dome-background/`：Justin OS 桌面背景的单面符号半球组件。
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

## 工作室功能与验证

- 居中房间与底部署名布局；背景、窗外颜色与室内照明按访客本地时钟插值，每 30 秒校准。
- 16 英寸 MacBook Pro（M2 Pro，2023）深空灰低多边形模型，依据 [Apple 规格](https://support.apple.com/en-gb/111838) 的 35.57 × 24.81 cm 比例和官方外观图制作，桌面占宽约 27%。
- 转椅用 2 秒完成整椅旋转，万向轮对齐运动切向并按路径长度滚动；采用受控运动曲线表达惯性感。
- 39 项 Node 测试覆盖现有功能、工作室稳定态恢复、时间光照及转椅运动曲线。构建、新增 TypeScript 文件检查和 `git diff --check` 通过。
- 本机 macOS 内置浏览器检查了 1280×720 与 390×844 布局、物件点击、面板 Escape、键盘入口、OS 往返、Markdown 窗口、路由刷新与前进/后退、过渡中切路由、WebGL 降级、减少动态效果和时间光照。预览数据位于独立 `.workspace/alpha-data/`。

## 当前风险

- 构建提示部分 chunk 超过 500 kB，Three.js 已动态导入。
- 真实手机 30fps 目标、长时间 GPU/内存稳定性及生产 Docker 部署未验收。个人介绍使用现有项目资料，完整简历和邮箱仍待提供。
- 首页和 Justin OS 过渡交互密集，需要在桌面和窄屏幕上进行视觉 QA。
- 路由外壳变更需要后退/前进和刷新检查，因为首页状态有意在当前浏览器标签页会话中保留。
- `public/os-desktop/` 内容在构建时扫描，重命名文件需要页面刷新或重新构建。
- 画布实时编辑通过单通道保存队列写入不可变 revision；需要持续验证离线重试和 `409` 冲突状态。
- Docker 生产运行时必须从 `dist/client/os-desktop` 扫描桌面内容；健康检查会阻止空桌面部署被视为正常。
