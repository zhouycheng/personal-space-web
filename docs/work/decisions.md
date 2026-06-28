# 活跃决策

此索引列出当前活跃的决策。当决策需要更多细节时，可将完整决策记录添加到 `docs/decisions/` 下。

| 日期 | 决策 | 状态 | 来源 |
| --- | --- | --- | --- |
| 2026-06-25 | 仓库根目录的 Astro 7 是当前运行时。 | Active | README.md |
| 2026-06-25 | 首页状态词汇为 `全显状态`、`推拉状态` 和 `Justin OS 状态`。 | Active | CONTEXT.md |
| 2026-06-25 | Justin Kit 组件以源文件优先形式存在于 `src/justin-kit/components/` 下。 | Active | src/justin-kit/README.md |
| 2026-06-26 | 桌面文件来自 `public/os-desktop/`，由 macOS 桌面组件渲染。 | Active | src/justin-kit/components/macos-desktop/README.md |
| 2026-06-26 | 项目工作流技能使用 `justinweb-` 前缀，位于 `.agents/skills/` 下。 | Active | .agents/skills/README.md |
| 2026-06-26 | Dock 导航使用真实路由 `/home`、`/works` 和 `/os`；`/` 保留为首页别名，客户端导航保留共享应用外壳。 | Active | src/components/app/JustinAppShell.astro |
| 2026-06-26 | 首页中途折叠的 `推拉状态` 进度从同标签页 `sessionStorage` 恢复，终端启动时序使用共享 20% 加速辅助。 | Active | src/components/app/homeRuntimeState.mjs |
| 2026-06-27 | 画布/白板使用 ReactFlow 节点编辑器，通过 better-sqlite3 进行 SQLite 持久化。 | Active | src/components/mine-canvas/MineCanvasEditor.tsx |
| 2026-06-28 | 画布保存使用 append-only revision 和 expectedRevision 乐观锁，旧版本不可变。 | Active | src/server/canvas/canvas-store.ts |
| 2026-06-28 | Docker 全屏桌面从 `dist/client/os-desktop` 扫描，空目录由 `/api/health` 报告失败。 | Active | src/pages/api/health.ts |
| 2026-06-28 | 画布数据库和资源每小时备份到本机与 S3 兼容 Restic 仓库。 | Active | ops/backup/ |
