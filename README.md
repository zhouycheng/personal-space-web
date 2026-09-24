<p align="center"><strong>JustinWeb 是一个可探索的个人 OS、作品集与空间画布</strong></p>

<p align="center">
  <a href="#核心能力"><img src="https://img.shields.io/badge/runtime-Astro%207-FF5D01" alt="Astro 7"></a>
  <a href="#核心能力"><img src="https://img.shields.io/badge/3D-Three.js-000000" alt="Three.js"></a>
  <a href="#核心能力"><img src="https://img.shields.io/badge/editor-ReactFlow-FF007A" alt="ReactFlow"></a>
  <br>
  <a href="https://github.com/zhouycheng/personal-space-web">GitHub</a> ·
  <a href="#快速开始">本地开发</a> ·
  <a href="#docker-部署">Docker 部署</a> ·
  <a href="docs/README.md">项目文档</a> ·
  <a href="CHANGELOG.md">更新日志</a>
</p>

JustinWeb 把个人介绍、项目作品、空间画布和文件驱动的桌面内容组织在同一个可探索的入口里。访客从三维工作室进入 Justin OS、文件夹或我的画布；Agent 在仓库维护画布内容，访客仅浏览并在本地保留拖动位置。

## 核心能力

- **三维工作室首页**：Three.js 桌椅、电脑、平板、文件架和台灯组成默认空间。可以拖动视角、使用滚轮在 `0.85×–2.2×` 之间缩放、点击部件和悬停查看提示。手机通过一个「探索」入口打开「去逛逛 / 视角 / 摆件」面板，按需访问内容、调整视角和操作物件；桌面键盘也可打开同一面板。MacBook 与咖啡杯包含近景细节，咖啡热气随场景可见性暂停；背景和灯光按访客本地时间变化。
- **空间化入口**：电脑进入 Justin OS，桌面平放的 iPad 进入我的画布，直立文件盒进入文件夹。电脑和 iPad 保持在场景中，由镜头转向屏幕正面并沿屏幕法线靠近，内容在过渡中贴屏渐显。
- **文件夹**：`/works` 由 `src/data/studioFiles.ts` 清单驱动，依次包含 FrameLean、QandA 和周耀程简历。作品引用 `src/data/projects.json`，保留预览、链接与安装包下载；简历正文维护在 `src/data/resume.json`。新增条目需在清单中引用对应内容，3D 文件、列表与数量随之更新。列表支持触摸、鼠标、滚轮和键盘，以单张卡片居中吸附；拖动达到中心间距的 25% 时切换相邻文件，否则动画弹回，点击才打开阅读详情。
- **Justin OS 桌面**：`/os` 使用 macOS 风格桌面组件，从 `public/os-desktop/` 递归读取 HTML、Markdown 和文件夹；桌面图标、窗口尺寸和显示设置支持本地持久化。
- **我的画布**：`/canvas` 使用 ReactFlow 提供无限画布、节点拖拽、连线、缩放、内联编辑和七种卡片类型：文字、图片、引用、链接、时间线、活动监控和名片。
- **实体日记本**：抽屉中的日记本进入 `/journal`。Markdown 在构建时自动分页，Three.js 呈现纸张正反面与卷曲翻页，支持手机单页、点击页面翻页、阅读书签、放大和文字阅读。写作与构建说明见 [日记文档](docs/features/journal.md)。
- **Justin Kit**：可复用组件源文件位于 `src/justin-kit/components/`，当前包含 Cursor Reveal Hero、Local Activity Status、macOS Desktop 和 Symbol Dome Background。
- **本地活动状态**：提供 macOS 前台应用监控脚本、鉴权更新接口、SSE 推送和 TTL 内存存储；画布监控卡片可消费实时状态，Justin Kit 徽章可按页面需要挂载。

## 路由

| 地址 | 页面 | 入口 |
| --- | --- | --- |
| `/` | 首页别名 | 客户端规范化到 `/home` |
| `/home` | 三维工作室 | 默认入口 |
| `/works` | 文件夹 | 直立文件盒入口或导航 |
| `/canvas` | 我的画布 | iPad 入口或导航 |
| `/os` | Justin OS | 电脑入口或导航 |
| `/journal`、`/journal/[slug]` | 实体日记本与文章 | 抽屉日记本或探索入口 |
| `/blog/[slug]`、`/rss.xml` | 旧路径重定向与订阅 | 原文章路径 / RSS |

URL 是界面状态的唯一来源。导航开始时更新地址，动画只负责视觉过渡；过渡中刷新会按 URL 打开稳定页面，返回首页不会追加重复的首页历史记录。

## 快速开始

### 环境要求

- Node.js `>=22.12.0`
- npm
- 如需运行本地活动监控，需要 macOS、`osascript` 和 System Events 辅助功能权限

`.node-version` 当前记录的本地版本为 `26.9.0`。

### 安装和启动

```bash
npm ci
npm run journal:setup
cp .env.example .env.local
npm run dev
```

开发服务器默认运行在 <http://localhost:4321>。首次使用本地活动监控时，在 `.env.local` 中补齐对应 token；不要把 `.env.local`、`.env.production` 或任何真实凭据提交到 Git。

需要本地活动监控时，在另一个终端运行：

```bash
npm run monitor:activity
```

常用命令：

```bash
npm run dev
npm run build
npm run preview
npm run journal:build
```

测试和定向类型检查：

```bash
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
```

## 数据与安全

- 画布内容在 `src/components/mine-canvas/mineCanvasData.ts` 维护，图片采用项目静态资源。
- 使用项目技能 `justinweb-canvas-content` 让 Agent 增删改查卡片、布局和样式。详见 [画布说明](docs/features/canvas.md)。
- 访客仅在浏览器保存拖动位置，恢复默认布局或清除站点数据即可重置。
- `/api/health` 检查画布内容及桌面资源，无数据库依赖。
- 本地活动监控使用 `ACTIVITY_MONITOR_TOKEN`，真实凭据保存在环境中，不提交到 Git。

## Docker 部署

普通 Web 服务：

```bash
docker compose up -d --build --force-recreate
```

部署后检查：

```bash
docker compose ps
docker compose logs --tail=80 justinweb
curl -fsS http://127.0.0.1:4321/api/health
```

生产容器从 `dist/client/os-desktop` 读取桌面文件，画布内容与图片随构建发布。

## 项目结构

```text
JustinWeb/
├── src/pages/                         路由入口和 API 路由
├── src/components/app/                共享外壳、导航和工作室状态协调
├── src/components/studio/             Three.js 工作室、物件入口和镜头过渡
├── src/components/works/              作品集和 FrameLean 预览
├── src/components/mine-canvas/        ReactFlow 画布浏览与卡片
├── src/justin-kit/components/         可复用 Justin Kit 组件
├── src/data/projects.json             作品集数据
├── public/os-desktop/                 Justin OS 文件驱动桌面内容
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
