<p align="center"><strong>JustinWeb 是一个可探索的个人 OS、作品集与可编辑画布</strong></p>

<p align="center">
  <a href="#核心能力"><img src="https://img.shields.io/badge/runtime-Astro%207-FF5D01" alt="Astro 7"></a>
  <a href="#核心能力"><img src="https://img.shields.io/badge/3D-Three.js-000000" alt="Three.js"></a>
  <a href="#核心能力"><img src="https://img.shields.io/badge/editor-ReactFlow-FF007A" alt="ReactFlow"></a>
  <a href="#数据与安全"><img src="https://img.shields.io/badge/data-SQLite-003B57" alt="SQLite"></a>
  <br>
  <a href="https://github.com/zhouycheng/personal-space-web">GitHub</a> ·
  <a href="#快速开始">本地开发</a> ·
  <a href="#docker-部署">Docker 部署</a> ·
  <a href="docs/README.md">项目文档</a> ·
  <a href="CHANGELOG.md">更新日志</a>
</p>

JustinWeb 把个人介绍、项目作品、可编辑画布和文件驱动的桌面内容组织在同一个可探索的入口里。访客从三维工作室进入 Justin OS、作品集或我的画布；作者可以在画布中编辑内容，并通过 SQLite revision 保留历史。

## 核心能力

- **三维工作室首页**：Three.js 低多边形桌椅、电脑、平板、文件架和台灯组成默认空间。可以拖动视角、点击部件、悬停查看提示；背景和灯光按访客本地时间变化。
- **空间化入口**：电脑进入 Justin OS，桌面平放的 iPad 进入我的画布，文件架进入作品集。电脑和 iPad 保持在场景中，由镜头转向屏幕正面并沿屏幕法线靠近，内容在过渡中贴屏渐显。
- **作品集**：`/works` 由 `src/data/projects.json` 驱动，当前包含 FrameLean 和 QandA，支持项目预览、标签、描述、GitHub/Gitee 链接和 FrameLean 安装包下载。
- **Justin OS 桌面**：`/os` 使用 macOS 风格桌面组件，从 `public/os-desktop/` 递归读取 HTML、Markdown 和文件夹；桌面图标、窗口尺寸和显示设置支持本地持久化。
- **我的画布**：`/canvas` 使用 ReactFlow 提供无限画布、节点拖拽、连线、缩放、内联编辑和七种卡片类型：文字、图片、引用、链接、时间线、活动监控和名片。
- **Justin Kit**：可复用组件源文件位于 `src/justin-kit/components/`，当前包含 Cursor Reveal Hero、Local Activity Status、macOS Desktop 和 Symbol Dome Background。
- **本地活动状态**：提供 macOS 前台应用监控脚本、鉴权更新接口、SSE 推送和 TTL 内存存储；画布监控卡片可消费实时状态，Justin Kit 徽章可按页面需要挂载。

## 路由

| 地址 | 页面 | 入口 |
| --- | --- | --- |
| `/` | 首页别名 | 客户端规范化到 `/home` |
| `/home` | 三维工作室 | 默认入口 |
| `/works` | 作品集 | 文件架入口或导航 |
| `/canvas` | 我的画布 | iPad 入口或导航 |
| `/os` | Justin OS | 电脑入口或导航 |

URL 是界面状态的唯一来源。导航开始时更新地址，动画只负责视觉过渡；过渡中刷新会按 URL 打开稳定页面，返回工作室不会追加重复的首页历史记录。

## 快速开始

### 环境要求

- Node.js `>=22.12.0`
- npm
- 如需运行本地活动监控，需要 macOS、`osascript` 和 System Events 辅助功能权限

`.node-version` 当前记录的本地版本为 `22.22.3`。

### 安装和启动

```bash
npm ci
cp .env.example .env.local
npm run dev
```

开发服务器默认运行在 <http://localhost:4321>。首次使用画布作者编辑或本地活动监控时，在 `.env.local` 中补齐对应 token；不要把 `.env.local`、`.env.production` 或任何真实凭据提交到 Git。

需要本地活动监控时，在另一个终端运行：

```bash
npm run monitor:activity
```

常用命令：

```bash
npm run dev
npm run build
npm run preview
npm run db:backup
npm run db:backup:check
npm run db:restore -- local latest
```

测试和定向类型检查：

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
```

## 数据与安全

- `.env*` 默认被 `.gitignore` 忽略，仓库只保留 `.env.example` 占位配置。
- `CANVAS_AUTH_TOKEN` 只在服务端校验作者登录；登录后使用 HttpOnly 会话 Cookie，并绑定当前标签页 token。
- 画布保存使用 SQLite append-only revision 和 `expectedRevision` 乐观锁。旧标签页不能覆盖更新版本，恢复旧版本会创建新的当前 revision。
- 图片和头像写入 `data/canvas-assets/`，使用内容地址和不可变 URL；数据库、资源、备份和恢复目录均不进入 Git。
- `/api/health` 同时检查生产桌面内容和 SQLite；任一项不可用时返回失败状态，不把空桌面视为健康部署。
- 备份先使用 SQLite Online Backup 创建快照，再执行完整性检查，之后写入本机或 S3 兼容的 Restic 仓库。恢复默认只写入 `restore/`，不会自动覆盖生产数据。

最小本地配置示例：

```dotenv
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:4321
CANVAS_AUTH_TOKEN=change-me-to-a-long-random-token
```

备份所需的密码、远端仓库和 AWS/S3 凭据只应通过本机 `.env`、`.env.local` 或部署环境注入，不能写入 README、源码或提交记录。

## Docker 部署

普通 Web 服务：

```bash
docker compose up -d --build --force-recreate
```

启用每小时画布备份：

```bash
docker compose --profile backup up -d --build --force-recreate
```

部署后检查：

```bash
docker compose ps
docker compose logs --tail=80 justinweb
curl -fsS http://127.0.0.1:4321/api/health
```

生产容器从 `dist/client/os-desktop` 读取桌面文件，数据通过 `./data` 挂载持久化。备份容器使用 `./backups` 和 `./restore`，恢复生产数据前必须先停止 Web 服务，并显式满足恢复脚本的确认条件。

## 项目结构

```text
JustinWeb/
├── src/pages/                         路由入口和 API 路由
├── src/components/app/                共享外壳、导航和工作室状态协调
├── src/components/studio/             Three.js 工作室、物件入口和镜头过渡
├── src/components/works/              作品集和 FrameLean 预览
├── src/components/mine-canvas/        ReactFlow 画布编辑器和卡片
├── src/justin-kit/components/         可复用 Justin Kit 组件
├── src/features/canvas/               画布协议、保存队列和客户端资源接口
├── src/server/canvas/                 SQLite、鉴权和资源存储边界
├── src/data/projects.json             作品集数据
├── public/os-desktop/                 Justin OS 文件驱动桌面内容
├── ops/backup/                        SQLite + Restic 备份容器
├── tests/                             Node 原生回归测试
└── docs/                              项目上下文、工作流和工作记录
```

## 文档

- [项目文档入口](docs/README.md)：文档索引和当前架构事实
- [项目上下文](CONTEXT.md)：路由和工作室状态词汇
- [当前工作](docs/work/active.md)：活跃界面、验证基线和风险
- [需求待办](docs/work/backlog.md)：候选需求池
- [活跃决策](docs/work/decisions.md)：当前工程决策
- [开发工作流](docs/develop/workflow.md)：范围、验证、Git 和部署规则
- [Justin Kit](src/justin-kit/README.md)：组件目录和提取边界
- [更新日志](CHANGELOG.md)：版本级变化和已验证里程碑

## 当前边界

- Justin Kit 当前以 `src/justin-kit/components/` 目录形式复用，专用 `/kit` 展示路由列为后续目录能力。
- Justin OS 当前聚焦文件驱动桌面、窗口和显示设置，Agent 聊天与底部终端属于后续产品范围。
- 本地活动状态通过 API、监控脚本和画布监控卡片提供；公开启动页的独立状态展示可按产品入口继续接入。
- 真实手机帧率、长时间 GPU/内存稳定性和生产环境实际 Docker 主机列入持续验收范围。
