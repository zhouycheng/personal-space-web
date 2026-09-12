# 当前工作

## 当前焦点

三维工作室首页连接 Justin OS、作品集与 ReactFlow 画布，提供物件交互、本地时间光照和可访问的内容入口。

## 活跃界面

- `src/pages/index.astro`：`/` 首页别名，渲染共享应用外壳。
- `src/pages/home.astro`、`src/pages/works.astro`、`src/pages/canvas.astro`、`src/pages/os.astro`：工作室、作品集、画布和 OS 路由入口。
- `src/components/app/JustinAppShell.astro`：共享路由外壳与工作室、OS、作品集、个人画布挂载点。
- `src/components/app/studioAppRuntime.ts`：URL 驱动的 History API 导航、空间动画；返回复用已有首页记录。
- `src/components/studio/`：程序化 Three.js 房间、三个内容入口、转椅动画、键盘/失败替代入口及本地时间光照插值。
- `src/components/app/homeRuntimeState.mjs`：保留的旧终端辅助，不再用于首页。
- `src/styles/global.css`：全局布局、启动屏幕动效、Dock 导航、个人画布、响应式规则和 OS 投影样式。
- `src/justin-kit/components/macos-desktop/`：可复用的 macOS 风格桌面和窗口系统。
- `src/justin-kit/components/symbol-dome-background/`：Justin OS 桌面背景的单面符号半球组件。
- `public/os-desktop/`：文件驱动的 Justin OS 桌面内容。
- `src/justin-kit/components/local-activity-status/`：本地活动运行时和监控。
- `src/components/mine-canvas/`：ReactFlow 画布编辑器、七种卡片类型和内联编辑；首次进入 `/canvas` 时才加载。
- `src/server/canvas/`：不可变 SQLite revision、作者会话和内容寻址图片资源。
- `ops/backup/`：每小时 SQLite 一致性快照、本机 Restic 与 S3 异地备份。

## 验证基线

- `rtk npm run build`。
- `rtk node --test tests/*.test.mjs`（App 外壳辅助逻辑）。
- 交互密集的变更需要浏览器预览，包括直接刷新 `/`、`/home`、`/works`、`/canvas` 和 `/os`。
- 本地活动变更需要环境和路由检查。

## 工作室功能与验证

- 居中独立桌椅与底部署名布局；移除墙体、地板模型、窗户和外围装饰，仅保留透明接影；背景、日光与桌面台灯按访客本地时钟插值，每 30 秒校准。
- 桌面平放的 iPad打开“我的画布”，桌面文件架打开悬浮卡片作品集；电脑和 iPad始终固定在场景中，共用约 1.45 秒的摄像机靠近/后退过渡，靠近末尾淡入可操作页面。个人画布保留原编辑器、鉴权和数据接口。
- 默认镜头位于桌椅左后方，主体居中，返回复用该视角；iPad 平放于桌面右侧，点击后相机靠近屏幕。
- 作品卡片按鼠标水平位置连续缓动，保留小数精度并限制最高移动速度；触屏及键盘均可浏览，点击卡片打开项目详情。底部仅保留作品数量，左上角返回入口无框。
- 16 英寸 MacBook Pro（M2 Pro，2023）深空灰低多边形模型，依据 [Apple 规格](https://support.apple.com/en-gb/111838) 的 35.57 × 24.81 cm 比例和官方外观图制作，桌面占宽约 27%。
- 转椅用 2 秒完成整椅旋转，万向轮对齐运动切向并按路径长度滚动；采用受控运动曲线表达惯性感。
- 42 项 Node 测试覆盖现有功能、工作室稳定态恢复、时间光照、转椅运动曲线、摄像机贴近距离及页面淡入时机与作品集缓动边界。
- 路由回归：Chrome 实测“作品集返回首页 → 进入 OS → 浏览器后退”回到 `/home`；`/os` 直达和刷新、`/canvas` 动画中刷新、画布前进后退均与 URL 一致。42 项测试、构建与定向类型检查通过。
- 本轮在 Chrome 检查了书架/画板实际点击、OS 与画布放大和收回中间帧、画布刷新恢复、作品详情、390×844 作品集布局、减少动态效果、前进后退；横移 45 帧采样无大幅位置跳变。构建、定向 TypeScript 检查及差异检查通过。Safari 的实际手感仍需设备端复核。
- 本机 macOS 内置浏览器检查了 1280×720 与 390×844 布局、物件点击、面板 Escape、键盘入口、OS 往返、Markdown 窗口、路由刷新与前进/后退、过渡中切路由、WebGL 降级、减少动态效果和时间光照。预览数据位于独立 `.workspace/alpha-data/`。

## 当前风险

- 构建提示部分 chunk 超过 500 kB，Three.js 已动态导入。
- 真实手机 30fps 目标、长时间 GPU/内存稳定性及生产 Docker 部署未验收。
- 首页和 Justin OS 过渡交互密集，需要在桌面和窄屏幕上进行视觉 QA。
- 路由外壳变更需要后退/前进、刷新与动画中途导航检查。旧版本已写入的浏览器历史无法批量清除，回归测试应从新首页记录开始。
- `public/os-desktop/` 内容在构建时扫描，重命名文件需要页面刷新或重新构建。
- 画布实时编辑通过单通道保存队列写入不可变 revision；需要持续验证离线重试和 `409` 冲突状态。
- Docker 生产运行时必须从 `dist/client/os-desktop` 扫描桌面内容；健康检查会阻止空桌面部署被视为正常。
