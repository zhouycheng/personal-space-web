# JustinView

个人网站，包含个人介绍、技能、项目展示和文稿，在首页顶部可以实时显示我的电脑的窗口活动状态。

当前项目基于 `Next.js 16`、`React 19`、`TypeScript` 和 `Tailwind CSS v4` 开发，内容以静态数据驱动。

## 项目特点

- 多页面个人站结构，包含首页、技能、项目、联系页和项目详情页
- 中英双语切换，语言状态通过 Cookie 保存
- 亮色 / 暗色主题切换，前端直接完成主题同步
- 首页头像旁边支持实时活动状态展示
- 响应式首页导航：移动端隐藏品牌文字，导航入口靠左，窄屏活动状态显示在头像下方，底部快捷按钮与头像右边界对齐
- 首页介绍标题在移动端和桌面端均保持单行，并针对中英文使用流式字号适配

## 目录结构

```text
├── public/                     # 静态资源，如头像、字体等
├── scripts/
│   └── activity-monitor.mjs    # 本地活动状态采集脚本（macOS）
├── src/
│   ├── app/
│   │   ├── (site)/             # 站点主页面：首页、技能、项目、联系
│   │   ├── (detail)/           # 项目详情页
│   │   └── api/
│   │       └── activity/       # 活动状态更新与 SSE 推送接口
│   ├── components/
│   │   ├── home/               # 首页视觉与活动状态相关组件
│   │   ├── site/               # 导航、项目卡片、页面壳等通用组件
│   │   └── theme/              # 主题与语言切换相关组件
│   └── lib/
│       ├── activity/           # 活动状态映射、存储与类型定义
│       ├── i18n/               # 多语言配置
│       ├── site/               # 站点内容数据源
│       └── theme/              # 主题逻辑
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

项目当前带的是 `package-lock.json`，默认按 `npm` 使用即可：

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

打开 `http://localhost:3000` 查看页面。

### 3. 构建生产版本

```bash
npm run build
npm run start
```

## 可用脚本

```bash
npm run dev              # 本地开发（webpack）
npm run dev:turbo        # 使用 Next 默认开发模式启动
npm run build            # 生产构建（webpack）
npm run start            # 启动生产环境
npm run lint             # 运行 ESLint
npm run monitor:activity # 启动本地活动状态监控脚本
```

## 活动状态功能

项目顶部支持展示类似“正在用 Cursor 写代码”这样的实时状态。

这套链路是单向的：

- `本地 Mac 脚本 -> 网站 API`：通过 `POST /api/activity/update` 推送最新状态
- `网站服务端 -> 浏览器`：通过 `GET /api/activity/stream` 使用 `SSE` 推送当前快照
- 浏览器不能反向控制本机
- 不保留历史记录，只保留当前有效状态

如果本地脚本停止、心跳超时，或者当前应用不在已配置列表中，页面上的状态会自动清除。

### 环境变量

在项目根目录创建 `.env.local`。推荐直接运行：

```bash
npm run monitor:activity:setup
```

也可以手动按 `.env.example` 补：

```bash
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:3000
```

如需调整轮询和心跳节奏，也可以继续补这些可选项：

```bash
ACTIVITY_MONITOR_POLL_INTERVAL_MS=2000
ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS=12000
ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS=4000
```

### 启动活动监控

先启动站点：

```bash
npm run monitor:activity:setup
npm run dev
```

再启动本地监控脚本：

```bash
npm run monitor:activity
```

### 注意事项

- 监控脚本仅支持 `macOS`
- 脚本通过 `osascript` 读取当前前台应用
- 只有在 `src/lib/activity/catalog.ts` 里登记过的应用，才会显示对应文案
- 状态只保留最新一次有效快照，不做消息历史存储
