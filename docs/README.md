# JustinWeb 文档

此文件夹汇总 JustinWeb 的项目文档。当前运行时、路由和数据边界以仓库根目录的 Astro 应用为准。

## 当前状态

当前主分支为 `main`，`archive/v1.0.0` 保留发布前的归档基线：

- 当前运行时为 Astro 7，使用 Node 独立适配器。
- 活跃应用根目录即本仓库根目录。
- Node 必须 `>=22.12.0`；`.node-version` 当前记录 `26.9.0`。
- 界面路由为 `/home`（工作室）、`/works`（作品集）、`/canvas`（画布）、`/os`（Justin OS）和 `/journal`、`/journal/[slug]`（日记）；`/` 为首页别名。返回首页复用已有首页历史记录。
- 首页为 Three.js 独立桌椅构图，不含墙体和可见地板：电脑连接 OS，桌面平放的 iPad 连接我的画布，桌面文件架连接悬浮卡片作品集。底部直接叠放居中署名；备用入口在键盘聚焦或加载失败时显示，首页隐藏 Dock。背景与灯光随访客本地时间连续变化。
- 电脑和 iPad 固定，镜头进入时先转向屏幕正面，再沿屏幕法线靠近；对应页面在屏幕填满视口的过程中渐显。状态定义见 `../CONTEXT.md`，直达、刷新和历史导航均以 URL 为准。
- 房间在首页、日记翻页和过渡阶段按需绘制；日记静止、全屏 OS 或页面隐藏时暂停连续绘制。减少动态效果设置会直接进入稳定页面，WebGL 失败时保留 HTML 内容入口与日记正文。
- 工作室采用胡桃木、暖白背景与深灰框架，交互强调色为灰绿 `#52614E`。材质色集中在 `src/components/studio/studioPalette.ts`；日记本采用深海军蓝素面硬封皮和哑银标题，笔记本电脑模型保留原有配色。座椅为无头枕的黑色中低背网面人体工学椅，弧形腰托贴合网背并连接两侧框架，下部双支座连接椅背与座面。
- Justin Kit 以源文件优先的组件库形式存在于 `src/justin-kit/` 下。
- `Cursor Reveal Hero`、`Local Activity Status` 和 `Symbol Dome Background` 为已提取组件。
- Justin OS 桌面背景使用单面符号半球，并保留纯克莱因蓝 `#002FA7` 基底。
- 本地活动 API 路由、监控脚本和徽章组件已接入 Justin Kit，启动页当前保留独立的本地活动集成入口。
- 基于 ReactFlow 的只读空间画布支持七种卡片、移动阅读和浏览器本地位置；内容通过 `justinweb-canvas-content` 技能在仓库维护，详见 [画布说明](features/canvas.md)。
- 生产全屏桌面扫描构建后的 `dist/client/os-desktop`，健康检查会检测空桌面和无效画布内容。

## 文档索引

- `features/journal.md`：实体日记本、Markdown 写作、构建时分页和验证入口。

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
- `archive/canvas-persistence/`：画布持久化方案的历史实现记录与设计稿。

## 更新规则

- 如果文档与源码不一致，以源码为准并更新文档。
- 运行 Astro 命令时使用 `.node-version` 中记录的 Node 版本。
- 保持根文档聚焦导航和运行时详情。
- 保持工作流和技能路由规则与 `.agents/skills/README.md` 同步。
- 保持组件级行为在各组件 README 中。
- 将已完成的实现计划记录为状态记录，而非保留为将来时态的计划。
- 只有已接入 `src/pages` 的首页区域、路由或组件预览才标记为已发布。
