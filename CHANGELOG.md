# 更新日志

主要记录 JustinWeb 的版本级变化。

这里记录面向发布、维护和回溯的简洁摘要，不记录每日流水账。可复用经验写入 `docs/lessons.md`，重要决策写入 `docs/work/decisions.md`。

## 记录格式

```text
YYYY-MM-DD｜vX.Y.Z｜Release 或 No Release
当天更新概要

### Added

- 新增内容

### Changed

- 更新内容

### Fixed

- 修复内容

### Verified

- 验证内容
```

同一天的多个提交会合并整理为简洁 bullet

## 2026-06-28｜v0.2.0｜No Release

白板系统从 MongoDB 迁移到 SQLite，重新设计内联文本编辑交互，升级 Astro 7.x，并完善 Docker 多阶段构建与部署流程。

### Added

- 新增不可变 `canvas_revisions` 历史表、revision 查询/恢复 API 和 `expectedRevision` 乐观锁；恢复旧内容时创建新版本，不修改历史数据。
- 新增画布图片资源 API，图片和头像以 SHA-256 内容地址存放在 `data/canvas-assets/`。
- 新增 HttpOnly 作者会话 API，移除浏览器明文密码和长期 Token 存储。
- 新增独立 SQLite/Restic 备份容器，支持每小时本机与 S3 兼容异地备份、分层保留、完整性检查和安全恢复。
- 新增 `/api/health`，检查生产桌面内容与 SQLite 可读性。
- 新增桌面扫描、Canvas Store、保存队列、鉴权、文档协议、资源存储和 API 回归测试。
- 新增基于 SQLite（better-sqlite3）的画布文档快照存储，替代 MongoDB 文档模型。
- 新增 `src/server/canvas/canvas-store.ts`：SQLite 数据库读写接口，支持 append-only revision、乐观锁写入和初始化种子数据迁移。
- 新增基于 contentEditable 的内联文本编辑系统（`MineCanvasInlineField`），替代旧的双击进入编辑模式交互。
- 新增卡片拖拽手柄，所有卡片类型支持通过拖拽手柄调整位置。
- Docker 多阶段构建新增 `/api/health` 健康检查，并由备份容器替代直接同步活动数据库脚本。
- 部署脚本新增 `.env` 和 `.env.local` 双文件加载支持。
- 画布鉴权只读取运行时 `CANVAS_AUTH_TOKEN`，不再向构建产物注入客户端鉴权变量。

### Changed

- 生产桌面扫描路径改为 `dist/client/os-desktop`，避免运行镜像缺少 `public/` 时全屏文件夹消失。
- 画布数据库返回前只显示安全加载状态，不再先渲染种子数据后瞬间替换。
- 画布重型依赖仅在首次进入 `/os` 时动态加载，并拆分 ReactFlow、Tiptap 与 UI 依赖块。
- 画布保存改为串行合并队列；旧标签页不能覆盖较新的数据库 revision。
- 将画布持久化从 MongoDB 迁移到 SQLite；后续升级为串行、合并且保留历史的 revision 保存模式。
- 将 Astro 从 6.x 升级到 7.x。
- 重新设计访客/作者权限模型：作者可编辑全部内容，访客仅可查看。
- 优化时间线卡片文字样式。

### Fixed

- 修复 Docker Compose 生产边界问题：画布 token 仅运行时注入，桌面内容显式扫描 `/app/dist/client/os-desktop`。
- 修复多阶段 Docker 构建中原生模块跨平台编译问题。
- 废弃直接 rsync 活动 DB/WAL/SHM 的同步脚本，改用 SQLite Online Backup + Restic。

### Verified

- 通过 Node 测试、TypeScript、Astro 构建、生产桌面扫描、备份脚本语法和 Compose quiet 校验。

---

## 2026-06-27｜v0.2.0｜No Release

画布系统核心实现日：基于 ReactFlow 的节点编辑器、卡片注册表、七种卡片类型、认证鉴权、持久化 API、Docker 部署、活动监控扩展、撤销/重做、名片卡片和 Turso/SQLite 存储。

### Added

- 新增基于 `@xyflow/react` 的画布节点编辑系统（`MineCanvasEditor`），支持节点拖拽、连线、缩放和平移。
- 新增卡片注册表（`card-registry`），支持按 `kind` 动态加载卡片组件：TextCard、ImageCard、QuoteCard、LinkCard、TimelineCard、MonitorCard、BusinessCard。
- 新增画布认证 Token 生成脚本和客户端 PBKDF2 + AES-GCM 鉴权辅助模块。
- 新增 `GET/POST /api/canvas` API 路由，实现画布数据的读写持久化。
- 新增画布编辑器的 API 加载、作者检测和自动保存机制。
- 新增云环境变量传递给 MineCanvasEditor，支持服务端鉴权。
- 新增活动监控核心库（`src/lib/activity`）和 `GET /api/activity/current` 端点。
- 新增 MonitorCard：三态显示（在线/离线/未知应用），支持活动状态实时更新。
- 新增 TimelineCard：支持拖拽排序时间节点，仅作者可编辑。
- 新增撤销/重做功能：Cmd+Z 撤销、Cmd+Shift+Z 重做，拦截浏览器默认保存行为。
- 新增 Cmd+S 手动保存、内联字段占位符和 MonitorCard 颜色分层显示。
- 新增 BusinessCard：支持头像、姓名、简介和标签展示。
- 新增画布中心点设置和删除快捷键。
- 新增 Dockerfile、dockerignore 和 docker-compose 部署配置。
- 新增活动目录扩展：30+ 趣味应用条目，支持未知应用显示。
- 新增活动监控双端点推送和心跳间隔优化（5s）。

### Changed

- 将卡片组件重构为注册表模式，统一按 `kind` 分发渲染。
- 将活动监控核心逻辑从组件目录提取到 `src/lib/activity`。
- 将画布存储迁移到 Turso/SQLite，优化渲染性能。
- 将 `author_passphrase` 重命名为 `author_password`。

### Fixed

- 修复编辑后点击画布空白处无限重渲染导致崩溃的问题。
- 修复画布写入临时文件跨文件系统原子重命名的问题。
- 修复保存错误指示器和鉴权 effect 卸载时的 guard 问题。
- 修复 Turso 写入失败问题：重新设计归一化表结构。
- 修复画布 auth 环境变量占位符和 data 文件 gitignore 遗漏。

### Verified

- 通过 `rtk npm run build`。

---

## 2026-06-26｜v0.1.0｜No Release

Justin OS 首页重构日：Astro 项目整理、首页状态机、作品集页面、macOS 桌面系统、工作流技能矩阵和真实路由整理。

### Added

- 新增 Justin OS 首页启动外壳、全屏投影和 macOS 风格桌面系统。
- 新增递归 `public/os-desktop/` 桌面扫描器，支持 HTML、Markdown 和文件夹窗口。
- 新增 JSON 驱动的作品集页面（`/works`）：项目排序、标签页、描述、标签、预览图和外部链接均来自 `src/data/projects.json`。
- 新增 Justin OS 桌面窗口系统：桌面图标可拖拽并持久化位置、窗口尺寸恢复、碰撞避免动画。
- 新增项目级工作流技能矩阵（`.agents/skills/`），包含需求池、功能分析、功能计划、实现、验证、交付和 Release 七个技能。
- 新增作品集整屏轮播比例适配。
- 新增首页推拉状态 sessionStorage 持久化：路由切换和刷新恢复同一过渡点。
- Justin Kit 组件库：提取 Cursor Reveal Hero、Local Activity Status 和 macOS Desktop 三个组件。

### Changed

- 将项目整理为 Astro Justin OS 工程结构。
- 将运行环境从旧 Next 实现切换到 Astro 根项目，旧 Next 代码已从工作树移除。
- 文档入口收敛为 `CONTEXT.md`、`README.md`、`docs/` 和组件 README。
- Dock 导航使用真实路由 `/home`、`/works`、`/os`；`/` 保留为首页别名。
- 首页终端启动速度统一加速 20%。

### Verified

- 通过 `rtk npm run build`。

---

## 2026-06-12｜v0.0.1｜No Release

修复移动端布局与响应式体验。

### Fixed

- 优化移动端布局与响应式体验。

### Verified

- 通过浏览器移动端视口检查。

---

## 2026-06-11｜v0.0.1｜No Release

活动目录扩展。

### Added

- 新增 Ghostty 终端模拟器到活动目录。

---

## 2026-06-10｜v0.0.1｜No Release

首次服务器部署配置。

### Added

- 新增服务器部署配置。
- Docker 构建阶段安装全部依赖。

---

## 2026-06-03｜v0.0.1｜No Release

项目工程整理。

### Changed

- 整理项目文件结构和代码组织。

---

## 2026-06-02｜v0.0.1｜No Release

项目模块内容更新。

### Changed

- 更新项目模块的内容和结构。

---

## 2026-05-31｜v0.0.1｜No Release

整体交互样式修改。

### Changed

- 修改整体交互视觉样式。

---

## 2026-05-27｜v0.0.1｜No Release

项目初始化。

### Added

- 网页项目初始化。
- 构建配置：排除 admin 目录避免 paths 别名冲突。

### Changed

- 删除 Admin 目录。
