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

- `src/pages/index.astro`、`src/pages/home.astro`、`src/pages/works.astro`、`src/pages/canvas.astro` 和 `src/pages/os.astro` 仅拥有路由入口。
- `src/app/navigation.ts` 决定 URL 与历史；`src/app/studioAppRuntime.ts` 组装依赖和协调页面生命周期；`src/presentation/ui/studio/explorePanel.ts` 管理探索弹窗与键盘焦点；`src/data/stores/studioClient.ts` 在每个页面实例内创建 Nano Stores。
- `src/contracts/` 定义无展示框架依赖的内容与端口；`src/application/` 决定用户意图；`src/animation/` 持有过场计算；`src/presentation/scene/` 持有 Three.js 场景和资源释放。
- `src/presentation/scene/studio/studioObjects.ts` 组装家具、设备和光照物件；`studioScene.ts` 管理渲染、相机与资源释放。`src/presentation/scene/journal/journalBookGeometry.ts` 构造实体书，`journalBook.ts` 管理阅读状态和纹理。`src/presentation/ui/` 持有 Astro/React 组件与样式；`src/presentation/interaction/` 持有 Three.js 拾取与独立手势规则。工作室 HTML 入口与 3D 拾取发送同一 `StudioIntent`。
- `src/content/` 持有个人内容；`src/data/repositories/` 统一读取；`src/data/selectors/` 派生文件盒和作品视图。`src/infrastructure/` 持有浏览器存储和服务端适配。
- `src/content/journal/` 维护 Markdown；普通 `dev`/`build` 由 `scripts/journal-content.mjs` 编译文字，`build:release` 再用 Chromium 生成固定书页。
- `src/presentation/ui/styles/` 按外壳、投影和导航拆分共享样式。
- `src/justin-kit/components/` 拥有可复用组件及其运行时文件。
- `public/os-desktop/` 仅拥有文件驱动的桌面内容。
- `src/pages/api/activity/` 拥有项目活动接口；update/current 使用 `src/data/stores/activity/`，stream 使用 `src/infrastructure/server/activityStream.ts`。全局 CLI 与开发监听脚本共享采集和上报实现。
- `src/content/canvas/published.ts` 拥有发布卡片，`src/presentation/ui/canvas/` 拥有浏览器与卡片组件，`src/infrastructure/client/canvasPositions.ts` 只保存位置。

## 命令

从仓库根目录运行命令，并用 `rtk` 作为命令段前缀：

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run build:release
rtk npm run check:boundaries
rtk npm run check:types
rtk npm run test:unit
rtk npm run test:e2e
rtk npm run preview
rtk npm run monitor:activity
```

开发和验证使用 `.node-version` 中的 Node 26.9.0；`package.json` engines 的最低要求为 `>=22.12.0`。

## 验证

- 基线：`rtk npm run build`、`rtk npm run check:boundaries` 和 `rtk npm run check:types`。发布书页另跑 `rtk npm run build:release`。
- App 外壳辅助逻辑：`rtk node --test tests/*.test.mjs`。
- UI 和动效变更需要在桌面和窄屏幕上进行浏览器预览。
- 路由外壳变更需要对 `/`、`/home`、`/works`、`/canvas` 和 `/os` 进行直接加载、刷新、动画中途导航和浏览器后退/前进检查。
- 桌面扫描器变更需要 `public/os-desktop/` 文件列表验证。
- Docker 桌面变更需要验证 `dist/client/os-desktop/`，并确认 `/api/health` 返回非空桌面计数。
- 画布变更验证本地位置恢复与重置、无效存储回退、卡片连线完整性和手机阅读。
- 本地活动变更需要路由和环境检查。

## Git 与交付

- 当前分支通常为 `main`；未经明确指示，不要创建、暂存、提交、推送、打标签或发布。
- 保留不相关的用户变更。
- 准备提交建议时使用 Conventional Commit 风格。
- 仅为值得回顾的版本级事实更新 `CHANGELOG.md`。

## 发布

正式发布文档应放在 `docs/releases/vX.Y.Z/release.md`，需要用户指定版本号。
