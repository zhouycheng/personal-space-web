# JustinSpace 文档

这里保留当前开发、部署和功能维护需要单独查阅的说明。仓库入口和运行命令见 [README](../README.md)。

## 开发与运维

- [架构与目录](develop/architecture.md)：源码归属、依赖方向和主要调用链。
- [开发工作流](develop/workflow.md)：需求范围、验证和交付规则。
- [部署手册](develop/deployment.md)：Docker 首次部署、运行密钥、GitHub Actions、活动监听器和源码运行。
- [发布内容授权清单](develop/rights-inventory.md)：当前跟踪内容的授权范围。
- [候选待办](work/backlog.md)：尚未接受的项目候选项。

## 功能说明

- [画布](features/canvas.md)：发布内容、访客位置保存和交互边界。
- [3D 日记](features/journal.md)：写作、书页包、阅读交互和资源验证。

## 历史与授权

- [变更日志](../CHANGELOG.md)：按日期记录版本和已验证的项目里程碑。
- [项目上下文](../CONTEXT.md)：共享术语和界面状态。
- [授权范围](../legal/LICENSING.md)：代码、个人内容与第三方材料的适用许可。

## 文档维护

- 当前行为以源码和对应功能说明为准；版本级变更记入根目录 CHANGELOG.md。
- 技能路由与工作区规则维护在 ../.agents/skills/README.md。
- 组件细节保留在 Justin Kit 与各组件自己的说明中。
