# Astro Justin Web

基于 Astro 重建的 JustinWeb 活跃版本。

当前版本将站点构建为 **Justin OS**，并引入 **Justin Kit**——一个个人组件库，用于可复用的 Web、动效、设计和 Flutter 模块。

## 当前实现

已实现：

- Astro 7 服务端项目，使用 `@astrojs/node` 独立模式运行。
- 界面地址：`/home` 工作室、`/works` 作品集、`/canvas` 我的画布、`/os` Justin OS；`/` 为首页别名，客户端规范化为 `/home`。
- URL 是界面状态的唯一来源。首页进入子页追加历史；返回工作室优先退回已知首页记录，直达子页则替换当前记录为首页，不追加重复首页。
- Three.js 低多边形独立桌椅构图：书桌、电脑、桌面文件架与台灯；桌面平放的 iPad连接个人画布。没有墙体和可见地板，仅保留透明接影。支持有限拖动视角。场景居中，底部仅保留 `JUSTIN / PERSONAL SPACE` 署名，首页不显示 Dock。
- 三个物件入口：电脑进入现有 Justin OS，iPad连接“我的画布”，桌面文件架打开悬浮卡片作品集；HTML 替代入口仅在键盘聚焦或 WebGL 失败时显示。
- 背景、日光与台灯随访客设备本地时间自动变化，每 30 秒更新，返回标签页立即校时；采用固定时段插值，不请求位置、不计算当地日出日落。
- 桌上电脑为 2023 款 16 英寸 MacBook Pro（M2 Pro）深空灰低多边形模型，依据 Apple 官方外观及机身宽深比例，宽度约占桌面 27%。转椅具备气压杆、五爪底座与双轮脚轮；点击后整椅用 2 秒完成一圈加速/减速旋转，万向轮逐渐对齐切向，轮子按路径长度滚动，重复点击不叠加。减少动态效果模式不播放转椅动画。
- 电脑和 iPad共用约 1.45 秒的空间过渡：物件固定，摄像机靠近表面，末尾淡入可操作页面，返回时相机后退；电脑进入 `/os`，iPad 进入 `/canvas`，复用原组件和数据。减少动态效果模式直接进入。
- 导航开始即更新 URL；过渡中刷新打开地址对应的稳定界面，不再读取旧 sessionStorage 界面标志。OS 内滚动不触发首页折叠。
- Three.js 按首页需要动态加载；房间采用按需绘制，在其他路由、桌面或后台停止绘制，页面销毁时释放资源。
- 各子界面提供返回工作室入口；当前空间界面不显示 Dock。
- JSON 驱动的悬浮卡片 `作品集`（`/works`，桌面文件架入口）：
  - 项目排序、标签页名称、标题、描述、标签、更新文本、开始文本、预览图路径和外部链接来自 `src/data/projects.json`；
  - 复用 FrameLean 工作台预览，QandA 使用文字封面；卡片详情保留现有项目描述、链接和下载；
  - 在房间背景前横向浏览卡片，鼠标位置连续控制有界位移，保留小数精度，缓动速度不超过 420 CSS px/s；触屏原生横滑，支持方向键。左上角为无框返回入口，底部仅显示作品数量。旧全屏纵向作品页不再挂载。
- `/canvas` 路由：可平移的无限画布个人页面；`/os` 专用于 Justin OS 桌面。
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
- 首页状态词汇：`room`（房间）、`entering` / `desktop` / `returning`（OS 进出），以及 `entering-canvas` / `canvas` / `returning-canvas`（画布进出）。
- Justin Kit 源文件夹和类型化目录。
- 已提取 `Cursor Reveal Hero` Astro 组件。
- 已提取 `Local Activity Status` Astro 组件。
- 已提取并挂载 `Symbol Dome Background` Astro 组件，用单面符号半球替换 Justin OS 桌面星星层。
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
  src/pages/os.astro                            `/os` Justin OS 桌面
  src/pages/canvas.astro                        `/canvas` 个人画布
  src/components/app/JustinAppShell.astro       共享 Dock 路由外壳
  src/components/app/studioAppRuntime.ts        路由和房间/OS 状态协调
  src/components/studio/                       Three.js 房间、状态辅助与 HTML 入口
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
  src/components/studio/StudioPortfolio.astro   悬浮卡片作品集
  src/assets/projects/                          作品集预览资源
  public/os-desktop/                            Justin OS 桌面文件
  src/justin-kit/                               组件库源文件
  src/playground/                               草图归档和未采用方案
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

每条记录提供待显示的完整文案，因此更新日期有意存储为字符串而非运行时格式化。使用 `summary` 和 `highlights` 作为单屏作品视图，较长的项目文案保留在 `description` 中供未来详情视图使用。

`preview` 是判别联合：普通图片使用 `kind: "image"` 并指向 `src/assets/projects/`，FrameLean 工作台使用组件预览。需要提供安装包的项目可增加 `downloads`，其中保存当前版本、发布页和各平台包；页面不在运行时请求 GitHub API。

```json
{
  "preview": {
    "kind": "image",
    "src": "/src/assets/projects/exercises-eagles-preview.svg",
    "alt": "QandA 软件预览图"
  }
}
```

```json
{
  "preview": {
    "kind": "framelean-workbench",
    "alt": "FrameLean 软件预览图"
  },
  "downloads": {
    "version": "1.2.1",
    "releasePage": "https://github.com/zhouycheng/FrameLean/releases/tag/v1.2.1",
    "packages": [
      {
        "id": "macos-universal-dmg",
        "platform": "macos",
        "format": "DMG",
        "label": "macOS Universal 2",
        "description": "Intel 与 Apple Silicon",
        "href": "https://github.com/zhouycheng/FrameLean/releases/download/v1.2.1/FrameLean-v1.2.1.dmg",
        "defaultForPlatform": true
      }
    ]
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
