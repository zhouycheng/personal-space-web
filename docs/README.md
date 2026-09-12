# JustinWeb 文档

此文件夹汇总 JustinWeb 的项目文档。当前运行时、路由和数据边界以仓库根目录的 Astro 应用为准。

## 当前状态

当前工作分支 `alpha/3d`：

- 当前运行时为 Astro 7，使用 Node 独立适配器。
- 活跃应用根目录即本仓库根目录。
- Node 必须 `>=22.12.0`；`.node-version` 当前记录 `22.22.3`。
- 界面路由为 `/home`（工作室）、`/works`（作品集）、`/canvas`（画布）和 `/os`（Justin OS）；`/` 为首页别名。返回工作室复用已有首页历史记录。
- 首页为 Three.js 独立桌椅构图，不含墙体和可见地板：电脑连接 OS，桌面平放的 iPad 连接我的画布，桌面文件架连接悬浮卡片作品集。底部直接叠放居中署名；备用入口在键盘聚焦或加载失败时显示，首页隐藏 Dock。背景与灯光随访客本地时间连续变化。
- 电脑和 iPad 固定，镜头进入时先转向屏幕正面，再沿屏幕法线靠近；对应页面在屏幕填满视口的过程中渐显。状态定义见 `../CONTEXT.md`，直达、刷新和历史导航均以 URL 为准。
- 房间在首页和过渡阶段按需绘制；全屏 OS 或页面隐藏时暂停。减少动态效果设置会直接进入稳定页面，WebGL 失败时保留 HTML 内容入口。
- 项目主题色为纯克莱因蓝 `#002FA7`（`rgb(0, 47, 167)`）。品牌蓝色 UI、终端屏幕、OS 桌面投影和激活 Dock 控件应使用此纯色，而非蓝色渐变。
- Justin Kit 以源文件优先的组件库形式存在于 `src/justin-kit/` 下。
- `Cursor Reveal Hero`、`Local Activity Status` 和 `Symbol Dome Background` 为已提取组件。
- Justin OS 桌面背景已由静态星星层替换为单面符号半球，仍保持纯克莱因蓝基底。
- 本地活动 API 路由、监控脚本和徽章组件已接入 Justin Kit，启动页当前保留独立的本地活动集成入口。
- 基于 ReactFlow 的画布/白板节点编辑器已实现，支持七种卡片类型、内联编辑、不可变 SQLite revision、资源持久化和本机/S3 自动备份。
- 生产全屏桌面扫描构建后的 `dist/client/os-desktop`，健康检查会检测空桌面和数据库故障。

## 文档索引

- `../CONTEXT.md`：共享词汇和首页状态定义。
- `../README.md`：仓库入口和迁移摘要。
- `../CHANGELOG.md`：版本级变化和已验证的里程碑。
- `work/active.md`：当前活跃界面、验证基线和风险。
- `work/backlog.md`：已确认的本地需求池。
- `work/decisions.md`：活跃决策索引。
- `develop/workflow.md`：工作流、范围门控、验证、Git 和发布规则。
- `lessons.md`：可复用的诊断和项目操作经验。
- `../.agents/skills/README.md`：项目级工作流技能路由和预读协议。
- `../src/justin-kit/README.md`：Justin Kit 目录和组件边界。
- `../src/justin-kit/components/cursor-reveal-hero/README.md`：光标揭示组件用法和行为。
- `../src/justin-kit/components/local-activity-status/README.md`：本地活动组件、API、时序和监控设置。
- `../src/justin-kit/components/symbol-dome-background/README.md`：符号半球背景的用法和行为。
- `plans/2026-06-25-astro-justin-os-kit.md`：Astro 重建实现记录。

## 更新规则

- 如果文档与源码不一致，以源码为准并更新文档。
- 运行 Astro 命令时使用 `.node-version` 中记录的 Node 版本。
- 保持根文档聚焦导航和运行时详情。
- 保持工作流和技能路由规则与 `.agents/skills/README.md` 同步。
- 保持组件级行为在各组件 README 中。
- 将已完成的实现计划记录为状态记录，而非保留为将来时态的计划。
- 只有已接入 `src/pages` 的首页区域、路由或组件预览才标记为已发布。
