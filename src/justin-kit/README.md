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

- `HTML`：HTML/CSS 视觉效果和页面区域。
- `JS Motion`：浏览器 API、本地运行时集成、SSE 和交互效果。
- `Design`：品牌规则、布局模式、色彩系统和视觉 QA 检查清单。
- `Flutter`：可复制的 Dart widget，用于 Flutter 项目。

## 当前已提取组件

- `cursor-reveal-hero`：首页圆形揭示英雄效果，现为独立 Astro 组件，带本地 CSS 和指针脚本。
- `local-activity-status`：macOS 前台应用监控、Astro API 运行时、SSE 徽章、应用目录、TTL 存储和监听脚本。
- `macos-desktop`：Justin OS 桌面图标层、递归桌面文件扫描器、macOS 风格窗口、图标拖拽、碰撞避免和显示控件。
- `symbol-dome-background`：Justin OS 桌面背景的 Canvas 符号半球，替代原星星层，带单面右转、海洋闪动和轻微鼠标朝向。

## 组件边界

每个已提取组件包含：

- 其 Astro 组件文件，
- 本地 CSS，
- 如需浏览器脚本，
- 如需运行时/服务端文件，
- 含可复制用法的 README，
- `source-notes.md`，说明来源实现和提取范围。

活跃的 Astro 页面可以导入组件，但组件不应依赖首页专属的 CSS 或数据。
