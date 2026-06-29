# Astro Justin Web

基于 Astro 重建的 JustinWeb 活跃版本。

当前版本将站点构建为 **Justin OS**，并引入 **Justin Kit**——一个个人组件库，用于可复用的 Web、动效、设计和 Flutter 模块。

## 当前实现

已实现：

- Astro 7 服务端项目，使用 `@astrojs/node` 独立模式运行。
- `Justin OS` 启动页路由 `/` 和 `/home`；`/` 保留为首页别名，底部 Dock 使用 `/home` 作为首页规范链接。
- 共享 Justin 应用外壳，服务于 Dock 路由 `/home`、`/works` 和 `/os`，通过 History API 导航确保刷新、后退和前进保留当前激活路由，而不是回退到首页。
- 全屏终端/笔记本视觉外壳，带相机式打开和滚轮回退动效。
- 终端启动序列：可跳过的逐字打字、`echo "I need some tokens and coffee"` 的随机错字/退格修正，以及 OS 启动前纯文本 `launchd [....] 00-100%` 进度条。终端打字、停顿、退格、输出等待和启动进度统一 20% 加速。
- OS 内滚轮交互：向下滚动将笔记本推离相机视野，向上滚动恢复全屏并重放菜单栏入场动画。中途折叠的 `推拉状态` 进度保存在同标签页 `sessionStorage` 中，路由切换和刷新恢复到同一过渡点，而不是重播全屏动画。
- 启动 Dock 带视觉导航链接：`首页`、`作品集`和`我的`。
- JSON 驱动的 `作品集` 路由（`/works`）：
  - 项目排序、标签页名称、标题、描述、标签、更新文本、开始文本、预览图路径和外部链接来自 `src/data/projects.json`；
  - 预览资源位于 `src/assets/projects/`；
  - 滚轮、触控板、键盘和顶部标签导航逐一切换全屏锁定轮播中的产品。
- `/os` 路由：可平移的无限画布个人页面。
- 全屏投影中的 macOS 风格 Justin OS 桌面：
  - 桌面文件从 `public/os-desktop/` 递归扫描；
  - `.html` 文件在 iframe 窗口内打开；
  - `.md` 文件在 Markdown 窗口内打开；
  - 文件夹以 Finder 风格窗口打开；
  - `组件库` 文件夹包含自包含的 Justin Kit HTML 预览；
  - 桌面图标可拖拽、位置持久化到本地、拖拽后自动避免重叠；
  - 手动调整的窗口尺寸可在下次打开时恢复。
- 活动监控系统双端点推送和心跳间隔 5 秒。
- 纯克莱因蓝主题：所有品牌蓝色界面和控件使用 `#002FA7` / `rgb(0, 47, 167)`，包括终端屏幕、OS 桌面投影和激活 Dock 项。屏幕背景必须为纯色，不使用渐变。
- 基于 ReactFlow 的白板/画布节点编辑系统，支持七种卡片类型、内联文本编辑和完善的工具栏。
- 首页状态词汇：
  - `全显状态`：完整的笔记本/终端外壳在浅色背景上可见。
  - `推拉状态`：笔记本离开过渡和电脑靠近过渡的统称。
  - `Justin OS 状态`：启动交互后的全屏蓝色 OS 投影。
- Justin Kit 源文件夹和类型化目录。
- 已提取 `Cursor Reveal Hero` Astro 组件。
- 已提取 `Local Activity Status` Astro 组件。
- 活动监控的 Astro API 路由。
- SQLite 驱动的画布持久化：每次保存追加不可变 revision，使用乐观锁阻止旧标签页覆盖新数据。
- 画布作者鉴权使用 HttpOnly 会话 Cookie + 当前标签页 `sessionStorage` token，浏览器不再保存明文密码或长期 Bearer Token；关闭标签页即销毁当前管理员身份。
- 画布图片和头像存放在 `data/canvas-assets/`，与 SQLite 一起进入本机和 S3 备份。
- 全屏桌面内容在开发环境读取 `public/os-desktop/`，生产环境读取构建产物 `dist/client/os-desktop/`。

尚未实现：

- 专用的 `/kit` 路由。
- 首页渲染 Justin Kit 目录卡片。
- 启动屏幕之外的完整 OS 区域，如 agent 聊天或底部终端。
- 全屏组件预览页面。

## 命令

Astro 7 需要 Node `>=22.12.0`。本仓库包含 `.node-version` 记录本地测试版本：

```bash
node -v
# 本地预期: v22.22.3
```

```bash
npm install
npm run dev
npm run build
npm run preview
npm run db:backup
npm run db:backup:check
npm run db:restore -- local latest
```

dev 和 preview 脚本绑定到 `0.0.0.0:4321`。

如果 `npm run build` 报告 Node `v20.x`，请在运行 npm 脚本前将 shell 切换到 `.node-version` 中的版本。

在本机上，直接验证 Astro 构建也可使用：

```bash
/Users/leftzhou/.hermes/node/bin/node node_modules/astro/bin/astro.mjs build
```

## 项目结构

```text
JustinWeb/
  src/pages/index.astro                         `/` 首页别名
  src/pages/home.astro                          `/home` 首页路由
  src/pages/works.astro                         `/works` 作品集路由
  src/pages/os.astro                            `/os` 个人路由
  src/components/app/JustinAppShell.astro       共享 Dock 路由外壳
  src/components/app/homeRuntimeState.mjs       首页过渡和终端时序辅助
  src/pages/api/activity/update.ts              POST 活动更新
  src/pages/api/activity/stream.ts              SSE 活动流
  src/pages/api/canvas.ts                       画布持久化 API
  src/pages/api/canvas/session.ts               作者会话 API
  src/pages/api/canvas/revisions.ts             不可变版本历史 API
  src/pages/api/canvas/assets/                  持久化图片资源 API
  src/pages/api/health.ts                       桌面与数据库健康检查
  src/layouts/BaseLayout.astro                  HTML 外壳
  src/styles/global.css                         路由外壳、启动、Dock 和 OS 样式
  src/data/kit.ts                               Justin Kit 目录
  src/data/projects.json                        作品集数据
  src/components/works/WorksPortfolio.astro     作品集 UI
  src/assets/projects/                          作品集预览资源
  public/os-desktop/                            Justin OS 桌面文件
  src/justin-kit/                               组件库源文件
  src/components/mine-canvas/                   画布编辑器组件
  src/server/canvas/                            SQLite、鉴权与资源存储边界
  src/features/canvas/                          文档协议、保存队列与客户端资源接口
  ops/backup/                                   SQLite + Restic 备份容器
```

## 画布数据安全

- 浏览器在数据库快照返回前只显示加载状态，不会先渲染种子节点再替换。
- `canvas_revisions` 只追加新版本；旧版本不会被更新或删除。
- 保存请求携带 `expectedRevision`。服务器版本已变化时返回 `409`，客户端停止覆盖并保留待保存内容。
- 恢复旧版本会创建一个新的当前 revision，历史链保持完整。
- 旧 `canvas` 表只用于首次迁移，不会在新保存流程中继续覆盖。

## 自动备份

备份服务每小时使用 SQLite Online Backup 创建一致性快照，执行完整性检查后同时写入本机 Restic 仓库和 S3 兼容仓库。默认保留 48 个小时版本、30 个日版本、12 个周版本和 12 个月版本。

在 `.env` 或 `.env.local` 配置 `RESTIC_LOCAL_PASSWORD`、`RESTIC_REMOTE_PASSWORD`、`RESTIC_REMOTE_REPOSITORY` 和 S3 凭据，然后启用备份 profile：

```bash
COMPOSE_PROFILES=backup docker compose up -d --build
```

`db:restore` 只恢复到 `restore/` 并运行 `PRAGMA integrity_check`，不会自动覆盖生产数据。应用正式恢复前必须先停止 Web 容器。

## 作品集数据

作品集页面通过 `src/data/projects.json` 管理。数组顺序即为顶部项目标签和全屏项目页的显示顺序。

每条记录提供待显示的完整文案，因此更新日期有意存储为字符串而非运行时格式化。使用 `summary` 和 `highlights` 作为单屏作品视图，较长的项目文案保留在 `description` 中供未来详情视图使用。预览图路径应指向 `src/assets/projects/` 中的文件，例如：

```json
{
  "preview": {
    "src": "/src/assets/projects/framelean-preview.svg",
    "alt": "FrameLean 软件预览图"
  }
}
```

API 路由文件有意从 Justin Kit 组件文件夹重新导出本地活动运行时，以保持组件的可移植性，同时将其接入 Astro：

```ts
export { POST, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-update";
export { GET, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-stream";
```

## 本地活动监控

从 `.env.example` 创建 `.env.local`，或在 shell 中导出相同的变量：

```bash
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:4321
ACTIVITY_MONITOR_POLL_INTERVAL_MS=2000
ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS=12000
ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS=4000
```

在此目录下用两个终端分别运行站点和监听器：

```bash
npm run dev
npm run monitor:activity
```

数据流为：

```text
macOS 前台应用 -> POST /api/activity/update -> 内存 TTL 存储 -> SSE /api/activity/stream -> LocalActivityStatus 徽章
```

注意事项：

- `ACTIVITY_MONITOR_TOKEN` 是 Astro `POST` 路由的必需参数。
- 监听器以 Bearer Token 形式发送 token。
- 脚本从当前工作目录加载 `.env.local` 和 `.env`。
- 监听器依赖 `/usr/bin/osascript` 和 macOS System Events。
- 运行监听器的终端应用可能需要辅助功能权限。
- 未知应用名称在添加到 `src/justin-kit/components/local-activity-status/runtime/catalog.ts` 之前会被隐藏。

## 文档

- `CONTEXT.md`：共享项目词汇，包括首页状态名称。
- `CHANGELOG.md`：版本级变化和已验证的里程碑。
- `.agents/skills/README.md`：项目级工作流技能路由和预读协议。
- `docs/work/`：当前工作、需求待办和决策索引。
- `docs/develop/workflow.md`：工作流、验证、Git 和发布规则。
- `docs/lessons.md`：可复用的操作经验教训。
- `src/justin-kit/README.md`：Justin Kit 目录和提取边界。
- `src/justin-kit/components/cursor-reveal-hero/README.md`：光标揭示组件用法。
- `src/justin-kit/components/local-activity-status/README.md`：本地活动组件和运行时用法。
- `docs/README.md`：仓库级文档索引。

## 历史备注

旧的 Next 实现仅作为源素材参考，已从工作树中移除。当前活跃的干净界面是本 Astro 根项目和已提取的 Justin Kit 组件文件夹。
