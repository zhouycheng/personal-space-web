# Justin Kit

Justin Kit 是 Justin OS 背后的个人组件库。

组件源码位于 `src/justin-kit/components`，当前页面通过正式业务组件按需接入。

## 首页状态词汇

首页启动状态应使用 `../../CONTEXT.md` 中定义的共享名称：

- `room`：三维桌椅工作室和可交互物件。
- `entering` / `returning`：镜头转向电脑屏幕正面并沿屏幕法线进出。
- `entering-canvas` / `returning-canvas`：镜头转向 iPad 屏幕正面并沿屏幕法线进出。
- `desktop`：全屏 Justin OS 投影。
- `canvas`：全屏个人画布。

## 分类

- `HTML`：Astro 标记、CSS 与可嵌入的页面区域。
- `JS Motion`：浏览器 API、Canvas 动画、SSE 和交互运行时。
- `Scripts`：macOS 活动采集、上报及全局 CLI。

## 当前模块

- `cloud-entrance`：独立 Canvas 云雾准备页，低对比文字凹痕、单行文字进度、悬停与受控揭幕，内容插槽不依赖场景。
- `local-activity-status`：macOS 前台应用采集、上报 CLI 与共享浏览器订阅源；由应用层接入活动 API 和画布卡片。
- `macos-desktop`：Justin OS 桌面图标层、递归桌面文件扫描器、macOS 风格窗口、图标拖拽、碰撞避免和显示控件。
- `symbol-dome-background`：Justin OS 桌面背景的 Canvas 符号半球，带单面右转、海洋闪动和轻微鼠标朝向。

## 组件边界

`runtime/domInstances.ts` 按 DOM 实例登记初始化和清理，真实移除时释放，BFCache 保留实例。`runtime/elementActivity.ts` 观察可见祖先和页面活动状态；装饰组件自身的 `aria-hidden` 不代表停止绘制。

组件的应用数据通过适配器注入。Kit 不导入本站内容、应用流程或 Store；活动订阅源由应用层组装共享连接，API 路由、TTL 存储与展示文案归本站业务层。

按模块职责维护：

- 展示组件的 Astro 文件与本地 CSS，
- 浏览器运行时、脚本及所需纯类型，
- 含当前接口、用法和生命周期规则的 README。

活跃的 Astro 页面可以导入组件，但组件不应依赖首页专属的 CSS 或数据。
