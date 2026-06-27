# 项目 Agent 备注

## 当前运行时

JustinWeb 现为 Astro 项目。活跃应用位于仓库根目录。

- 使用 Node `>=22.12.0`；`.node-version` 当前锁定 `22.22.3`。
- 从此仓库根目录运行应用命令。
- 旧 Next 实现已移除。除非用户明确要求，否则不要添加或恢复 Next 代码。

## 命令

在此仓库中运行 shell 命令时，除非调试需要原始输出，否则用 `rtk` 作为命令前缀。

常用命令：

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run preview
rtk npm run monitor:activity
```

## 文档

- 保持根目录 `README.md` 作为仓库导航页。
- 保持当前运行时详情在 `README.md` 中。
- 保持 Justin Kit 规则在 `src/justin-kit/README.md` 中。
- 保持组件用法在各组件文件夹内。
- 使用 `.agents/skills/README.md` 作为项目级工作流技能索引。
- 使用 `docs/develop/workflow.md` 作为持久化工作流真相来源。
- 保持当前工作和待办在 `docs/work/` 中。
- 如果文档与源码不一致，更新文档以匹配源码。
