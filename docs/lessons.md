# 经验教训

## 运行时

- Astro 7 需要 Node `>=22.12.0`；Node 20 的失败应视为环境偏差，先于应用调试处理。
- `rtk npm run build` 是仓库变更的基线验证命令。

## 文档与运行时

- 当文档与源码不一致时，以源码为准并在交付时更新文档。
- 将当前路由、组件挂载点和验证结果写入面向使用者的文档；规划项保留在 `docs/work/` 或对应历史记录中。

## UI 与动效

- 首页状态统一使用 `CONTEXT.md` 中的 `room`、`entering`、`desktop`、`returning`、`entering-canvas`、`canvas` 和 `returning-canvas`。
- 屏幕入口的镜头过渡先完成正面校准，再沿屏幕法线靠近；页面内容随投影范围渐显。
- Justin OS 过渡工作需要视觉 QA，因为全屏固定层、Dock 导航和页面过渡可能以微妙方式交互。

## 本地活动

- 活动监控仅限 macOS，因为它依赖 `/usr/bin/osascript` 和 System Events。
- `ACTIVITY_MONITOR_TOKEN` 是 `POST /api/activity/update` 的必需参数。

## 画布/白板

- 画布编辑器的状态更新需要特别注意 React 18/19 的批量更新机制。`setNodes(updater)` 回调在有 pending lanes 时不会同步执行，导致 `nodesRef.current` 在 `flushSave()` 读取时为过期数据。修复方案：直接使用 `nodesRef.current` 计算新状态，更新 ref，然后调用 `setNodes(next)`。
- TipTap React `useEditor` 通过 ref 回调间接调用 `this.options.current.onUpdate`，确保始终调用最新的回调函数。
