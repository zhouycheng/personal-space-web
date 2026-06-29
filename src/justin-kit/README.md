# Justin Kit

Justin Kit 是 Justin OS 背后的个人组件库。

此首个 Astro 版本以源文件优先的方式保留组件库。类型化目录位于 `src/data/kit.ts`，完整的已提取组件源码位于 `src/justin-kit/components`。

目录已为未来的首页区域或 `/kit` 路由做好准备，但当前首页尚未渲染它。

## 首页状态词汇

首页启动状态应使用 `../../CONTEXT.md` 中定义的共享名称：

- `全显状态`：完整的笔记本/终端外壳在浅色背景上可见。
- `推拉状态`：笔记本离开过渡和电脑靠近过渡。
- `Justin OS 状态`：启动后的全屏蓝色 OS 投影。

## 分类

- `HTML`：HTML/CSS 视觉效果和页面区域。
- `JS Motion`：浏览器 API、本地运行时集成、SSE 和交互效果。
- `Design`：品牌规则、布局模式、色彩系统和视觉 QA 检查清单。
- `Flutter`：可复制的 Dart widget，用于 Flutter 项目。

## 当前已提取组件

- `cursor-reveal-hero`：旧首页遮罩/揭示英雄效果，现为独立 Astro 组件，带本地 CSS 和指针脚本。
- `local-activity-status`：macOS 前台应用监控、Astro API 运行时、SSE 徽章、应用目录、TTL 存储和监听脚本。
- `macos-desktop`：Justin OS 桌面图标层、递归桌面文件扫描器、macOS 风格窗口、图标拖拽、碰撞避免和显示控件。
- `symbol-dome-background`：Justin OS 桌面背景的 Canvas 符号半球，替代原星星层，带单面右转、海洋闪动和轻微鼠标朝向。

## 计划中的目录条目

- `justin-brand-dna`：设计令牌、布局规则和视觉 QA 规则。
- `flutter-status-chip`：可复制的 Dart 状态徽章，用于 Flutter 项目。

这些计划中的条目已存在于 `src/data/kit.ts` 中，以便在文件创建之前设计 UI 契约。

## 组件边界

每个已提取组件应拥有：

- 其 Astro 组件文件，
- 本地 CSS，
- 如需浏览器脚本，
- 如需运行时/服务端文件，
- 含可复制用法的 README，
- `source-notes.md`，说明从旧应用中提取了什么。

活跃的 Astro 页面可以导入组件，但组件不应依赖首页专属的 CSS 或数据。

## 下一步

下一步应将每个已提取组件转变为：

- 一个一流的全页 Astro 预览路由，
- 可复制的源码片段，
- 一张视觉截图，
- 一份小型 QA 检查清单。
