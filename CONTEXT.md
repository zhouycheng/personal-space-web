# JustinWeb 上下文

本文档记录项目词汇，应在规划、实现、测试和设计讨论中保持一致。

## 首页状态词汇

讨论首页工作室体验时使用以下名称：

- `room`：默认房间全景，可以拖动视角、点击物件或使用 HTML 入口。
- `entering`：点击电脑后，相机拉近电脑的短暂过渡。
- `desktop`：全屏 Justin OS 桌面，房间暂停绘制。
- `returning`：点击返回工作室后，相机回到房间的短暂过渡。

只持久化 `room` 和 `desktop`。`entering` 中断回到 `room`，`returning` 中断回到 `desktop`。旧终端与滚动推拉状态不参与当前恢复逻辑；`homeRuntimeState.mjs` 仅保留为历史辅助代码。

这些术语描述的是首页状态，而非独立路由。后续 README、计划、测试笔记、issue 标题和实现注释中引用启动页时，请与此词汇保持一致。

## 文档入口

- `README.md`：当前运行时、命令、实现状态和项目结构。
- `CHANGELOG.md`：版本级变化和已验证的里程碑。
- `docs/README.md`：仓库文档索引。
- `docs/work/`：当前工作、待办和决策。
- `docs/develop/workflow.md`：持久化的工作流和验证规则。
- `.agents/skills/README.md`：项目级技能矩阵和路由。
