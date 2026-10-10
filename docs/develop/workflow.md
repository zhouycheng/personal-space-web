# JustinSpace 开发工作流

## 真相来源

- 运行时和设置：`README.md`。
- 稳定词汇：`CONTEXT.md`。
- 文档索引：`docs/README.md`。
- 已验证的日期记录：根目录 `CHANGELOG.md`。
- Justin Kit 规则：`src/justin-kit/README.md`。
- 项目级技能：`.agents/skills/README.md`。

## 需求与范围门控

- 候选需求在工作会话中讨论，临时方案放在已忽略的 `.workspace/`；维护文档描述已实现的项目事实。
- 实现需要已接受的范围，除非用户明确要求端到端执行。
- 临时计划和实验结果保留在已忽略的 `.workspace/`；任务结束后清理不再需要的生成物。持久事实写入对应的长期说明或 `CHANGELOG.md`。

## 架构边界

- `src/pages/index.astro`、`src/pages/home.astro`、`src/pages/works.astro`、`src/pages/canvas.astro` 和 `src/pages/os.astro` 仅拥有路由入口。
- `src/app/navigation.ts` 决定 URL 与历史；`src/app/studioAppRuntime.ts` 组装依赖和协调页面生命周期；`src/presentation/ui/studio/explorePanel.ts` 管理探索弹窗与键盘焦点；`src/data/stores/studioClient.ts` 在每个页面实例内创建 Nano Stores。
- `src/contracts/` 定义无展示框架依赖的内容与端口；`src/application/` 决定用户意图；`src/animation/` 持有过场计算；`src/presentation/scene/` 持有 Three.js 场景和资源释放。
- `src/presentation/scene/studio/studioObjects.ts` 组装家具、设备和光照物件；`studioScene.ts` 管理渲染、相机与资源释放。`src/presentation/scene/journal/journalBookGeometry.ts` 构造实体书，`journalBook.ts` 管理书本姿态、纹理与有效绘制报告；阅读规则由 `src/application/journal/readerController.ts` 管理。`src/presentation/ui/` 持有 Astro/React 组件与样式；`src/presentation/interaction/` 持有 Three.js 拾取与独立手势规则。工作室 HTML 入口与 3D 拾取发送同一 `StudioIntent`。
- `src/content/` 持有个人内容；`src/data/repositories/` 统一读取；`src/data/selectors/` 派生文件盒和作品视图。`src/infrastructure/` 持有浏览器存储和服务端适配。
- `src/content/journal/` 维护 Markdown；普通 `dev`/`build` 无 Chromium 校验当前固定书页包。开发缺包/过期显示状态，生产严格失败。`journal:build` 显式生成不可变版本包，`build:release` 生成、校验、构建并校验 dist。真实分页测试独立运行，不混入 Node 单元测试。
- `src/presentation/ui/styles/` 按外壳、投影和导航拆分共享样式。
- `src/justin-kit/components/` 拥有可复用组件及其运行时文件。
- `public/os-desktop/` 仅拥有文件驱动的桌面内容。
- `src/pages/api/activity/` 拥有项目活动接口；update/current 使用 `src/data/stores/activity/`，stream 使用 `src/infrastructure/server/activityStream.ts`。全局 CLI 与开发监听脚本共享采集和上报实现。
- `src/content/canvas/published.ts` 拥有发布卡片，`src/presentation/ui/canvas/` 拥有浏览器与卡片组件，`src/infrastructure/client/canvasPositions.ts` 只保存位置。

## 命令

从仓库根目录运行命令，并用 `rtk` 作为命令段前缀。以下是可用命令，不是每个任务的必跑清单：

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

先根据改动行为和调用关系确定影响范围，再选择足以验证当前目标的检查。`build`、`check:boundaries` 和 `check:types` 分别按需选择，没有固定必跑组合。

| 改动 | 选择依据 |
| --- | --- |
| 文档、项目 Skill | 检查内容、链接、索引、元数据及 Skill 格式，不运行应用构建或业务测试；Skill 格式校验遵循 `justinspace-skill-create`。 |
| 局部逻辑 | 运行覆盖改动与受影响调用方的 Node 测试文件；同一文件混合多个行为时用 `--test-name-pattern` 筛选。 |
| 类型、导入、构建 | 需要验证类型及调用方兼容性时选择 `check:types`；改动影响导入或分层依赖时选择 `check:boundaries`；验证打包、服务端输出或需要更新被测生产产物时选择 `build`。 |
| UI、动画、浏览器兼容 | 检查相关组件、状态和中间帧；响应式行为受影响时覆盖桌面及窄屏。E2E 指定 spec、相关用例和浏览器项目，通常先选 `desktop-chromium`，兼容问题改选目标浏览器，需要移动布局时选对应项目。 |
| 共享流程、路由与外壳 | 沿调用关系选择受影响入口的直接加载、刷新、后退/前进、动画中途导航或尺寸变化用例，不因文件共享就追加其他模块回归。 |
| 内容、存储、扫描器、活动接口 | 按改动选择内容与边端点、位置恢复/重置、无效存储回退、静态资源、文件扫描、接口认证或事件流用例。涉及生产桌面扫描或部署时检查构建内容及 `/api/health`。 |

下面展示指定文件、用例和浏览器的方式；每次只选择与改动相关的命令：

```bash
rtk node --test tests/entrance.test.mjs
rtk node --test --test-name-pattern='palette follows local' tests/entrance.test.mjs
rtk npm run test:e2e -- tests/e2e/entrance.spec.ts --project=desktop-chromium --grep='standalone component'
```

- `test:unit` 覆盖全部根目录单元测试文件；未筛选的 `test:e2e` 覆盖全部 spec 和配置的浏览器项目。本地全量回归仅在用户明确要求时运行，当前 CI 的全量单测、静态检查与构建门禁保持不变。
- E2E 默认使用生产产物。被测服务必须包含当前改动；需要更新产物时执行一次 `build`，不能用旧 `dist` 的通过结果验证新代码。构建自带的日记包完整性校验保留，它不要求追加日记阅读回归。
- 只有日记内容、分页/渲染生成输入或包格式变更需要重新生成书页时，才在对应范围内运行 `journal:build` 或 `build:release`；阅读运行时或其他模块修改不自动触发生成。
- 代码、检查范围与环境一致且证据可核实时复用结果。任务结束、Skill 调用、交接、新 Agent 或新会话都不是重跑理由；只有新改动、失败或未解决的问题才补跑。扩大检查前说明具体影响或失败路径，不增加确认环节。
- 性能采样仅在用户要求或需要支撑性能结论时开展；采样条件与重复次数遵循 `AGENTS.md`。普通功能修改不自动启动性能测量。
- 汇报实际执行的检查和结果，区分构建、类型检查、浏览器观察及未验证行为，不把定向验证表述成完整回归。

## Git 与交付

- 日常开发默认使用 `develop`；用户授权提交或推送时，默认目标也是 `develop`。
- `main` 是受保护的生产分支，禁止直接推送。生产变更通过 `develop` 到 `main` 的 PR 合并；PR 必须通过 `verify`，不要求额外审批。推送到 `develop` 不会部署生产环境。
- 除用户明确要求外，不创建或切换分支、不提交或推送、不打标签或发布。
- 保留不相关的用户变更。
- 准备提交建议时使用 Conventional Commit 风格。
- 已验证的开发历史统一写入根目录 `CHANGELOG.md`；功能文档和组件 README 保留当前行为与维护方法。

## 发布

发布说明写入根目录 `CHANGELOG.md`，需要用户指定版本号。确认版本后再加入对应的日期记录；不另建版本文档。
