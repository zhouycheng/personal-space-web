# 活跃决策

此索引列出当前活跃的决策。当决策需要更多细节时，可将完整决策记录添加到 `docs/decisions/` 下。

| 日期 | 决策 | 状态 | 来源 |
| --- | --- | --- | --- |
| 2026-06-25 | 仓库根目录的 Astro 7 是当前运行时。 | Active | README.md |
| 2026-09-11 | 工作室采用无墙体、无可见地板的独立桌椅布局；桌面平放的 iPad 连接画布，桌面文件架连接作品集。电脑与 iPad 固定，镜头先转向屏幕正面，再沿屏幕法线靠近和后退，页面在投影过程中渐显。 | Active | src/components/studio/studioScene.ts |
| 2026-06-25 | Justin Kit 组件以源文件优先形式存在于 `src/justin-kit/components/` 下。 | Active | src/justin-kit/README.md |
| 2026-06-26 | 桌面文件来自 `public/os-desktop/`，由 macOS 桌面组件渲染。 | Active | src/justin-kit/components/macos-desktop/README.md |
| 2026-06-26 | 项目工作流技能使用 `justinweb-` 前缀，位于 `.agents/skills/` 下。 | Active | .agents/skills/README.md |
| 2026-09-11 | 界面使用 `/home`、`/works`、`/canvas`、`/os` 独立路由；`/os` 专用于 Justin OS，画布使用 `/canvas`。 | Active | src/app/navigation.ts |
| 2026-09-11 | URL 决定界面，过渡中刷新按地址恢复；返回工作室复用已知首页历史，不追加重复首页。 | Active | src/components/app/studioAppRuntime.ts |
| 2026-06-28 | Docker 全屏桌面从 `dist/client/os-desktop` 扫描，空目录由 `/api/health` 报告失败。 | Active | src/pages/api/health.ts |

| 2026-09-24 | 画布采用仓库维护内容与组件、访客浏览及本地拖动位置；移除数据库与备份服务。 | Active | docs/features/canvas.md |
