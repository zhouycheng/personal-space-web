# JustinWeb 开发工作流

## 真相来源

- 运行时和设置：`README.md`。
- 稳定词汇：`CONTEXT.md`。
- 文档索引：`docs/README.md`。
- 当前工作和待办：`docs/work/`。
- Justin Kit 规则：`src/justin-kit/README.md`。
- 项目级技能：`.agents/skills/README.md`。

## 需求与范围门控

- 在添加到 `docs/work/backlog.md` 之前讨论候选需求。
- 实现需要已接受的范围，除非用户明确要求端到端执行。
- 将临时计划保留在 `.workspace/plans/`，将持久化事实保留在 `docs/`。

## 架构边界

- `src/pages/index.astro`、`src/pages/home.astro`、`src/pages/works.astro` 和 `src/pages/os.astro` 仅拥有路由入口。
- `src/components/app/JustinAppShell.astro` 拥有共享 Dock 路由外壳、启动交互、History API 导航和 OS 投影挂载点。
- `src/styles/global.css` 拥有共享布局和动效样式。
- `src/justin-kit/components/` 拥有可复用组件及其运行时文件。
- `public/os-desktop/` 仅拥有文件驱动的桌面内容。
- `src/pages/api/activity/` 应保持为本地活动运行时处理器的薄重导出。
- `src/components/mine-canvas/` 拥有画布编辑器、卡片组件和持久化逻辑。
- `src/features/canvas/` 拥有画布文档协议和串行保存队列。
- `src/server/canvas/` 拥有数据库、不可变 revision、鉴权和资源文件边界。
- `ops/backup/` 独立于 Web 进程执行备份与恢复校验。

## 命令

从仓库根目录运行命令，并用 `rtk` 作为命令段前缀：

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run preview
rtk npm run monitor:activity
```

Node 必须满足 `.node-version` 和 `package.json` engines 要求：`>=22.12.0`。

## 验证

- 基线：`rtk npm run build`。
- App 外壳辅助逻辑：`rtk node --test tests/*.test.mjs`。
- UI 和动效变更需要在桌面和窄屏幕上进行浏览器预览。
- 路由外壳变更需要对 `/`、`/home`、`/works` 和 `/os` 进行直接加载、刷新和浏览器后退/前进检查。
- 桌面扫描器变更需要 `public/os-desktop/` 文件列表验证。
- Docker 桌面变更需要验证 `dist/client/os-desktop/`，并确认 `/api/health` 返回非空桌面计数。
- 画布存储变更需要验证旧 revision 可读取、冲突写入返回 `409`、SQLite 完整性和恢复到临时目录。
- 本地活动变更需要路由和环境检查。

## Git 与交付

- 当前分支通常为 `main`；未经明确指示，不要创建、暂存、提交、推送、打标签或发布。
- 保留不相关的用户变更。
- 准备提交建议时使用 Conventional Commit 风格。
- 仅为值得回顾的版本级事实更新 `CHANGELOG.md`。

## 发布

正式发布文档应放在 `docs/releases/vX.Y.Z/release.md`，需要用户指定版本号。
