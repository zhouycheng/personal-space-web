# JustinWeb 上下文

本文档记录项目词汇，应在规划、实现、测试和设计讨论中保持一致。

## 首页状态词汇

讨论首页工作室体验时使用以下名称：

- `room`：默认房间全景，可以拖动视角、点击物件或使用 HTML 入口。
- `entering`：点击电脑后，相机拉近电脑的短暂过渡。
- `desktop`：全屏 Justin OS 桌面，房间暂停绘制。
- `returning`：点击返回工作室后，相机回到房间的短暂过渡。
- `entering-canvas`：墙上画板向全屏个人画布展开。
- `canvas`：全屏个人画布，复用既有 ReactFlow 编辑器，房间暂停绘制。
- `returning-canvas`：个人画布收回墙上画板。

URL 是唯一界面状态来源：`/home` 对应房间，`/os` 对应桌面，`/canvas` 对应个人画布，`/works` 对应作品集。导航开始即更新地址，动画只负责视觉过渡；中途刷新按 URL 打开稳定界面。旧 sessionStorage 标志不再参与恢复。返回工作室复用已知首页历史记录，无法确定来源时替换当前记录，不猜测上一页。

这些术语描述空间动画状态，稳定界面与独立路由对应。旧终端辅助 `homeRuntimeState.mjs` 不参与当前路由。

## 文档入口

- `README.md`：当前运行时、命令、实现状态和项目结构。
- `CHANGELOG.md`：版本级变化和已验证的里程碑。
- `docs/README.md`：仓库文档索引。
- `docs/work/`：当前工作、待办和决策。
- `docs/develop/workflow.md`：持久化的工作流和验证规则。
- `.agents/skills/README.md`：项目级技能矩阵和路由。
