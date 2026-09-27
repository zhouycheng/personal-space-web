# JustinSpace 架构与目录

Astro 负责路由与服务端渲染，React 负责画布，Three.js 负责工作室和日记实体书。稳定页面状态由 URL 决定；访客侧临时状态由每次挂载创建的 Nano Stores 与组件内状态持有。

## 目录职责

| 目录 | 责任 | 依赖方向 |
| --- | --- | --- |
| `src/pages/` | `/home`、`/works`、`/canvas`、`/os`、`/journal` 和 API 入口 | 装配其他层，入口保持薄 |
| `src/app/` | 路由、History API、依赖装配及页面生命周期 | 可组合内部层 |
| `src/contracts/` | 内容模型、`StudioIntent`、`ScenePort`、`TransitionPort` | 只依赖本层；不含 DOM、ReactFlow、Three.js |
| `src/content/` | 简历、作品、文件顺序、画布发布内容、日记和站点素材 | 可引用纯契约；真实个人内容另受 [CONTENT-LICENSE.md](../../legal/CONTENT-LICENSE.md) 约束 |
| `src/config/` | 场景配色、光照和书本外观 | 纯配置 |
| `src/data/repositories/` | 发布内容读取入口 | 内容与契约 |
| `src/data/selectors/` | 文件盒、作品列表、画布结构、实体书页等纯派生数据 | 输入参数、契约与配置；不读取 repository |
| `src/data/stores/` | 按页面实例创建的客户端状态、活动快照 | selector 与契约；访客状态不存服务端全局变量 |
| `src/application/` | 用户意图到导航/场景命令、日记阅读规则和活动状态规则 | 契约与数据；不依赖展示实现 |
| `src/presentation/scene/` | 3D 物件、灯光、渲染、GPU 资源释放 | 契约、配置和动画函数；文件资料由装配层注入 |
| `src/presentation/interaction/` | Three.js 拾取、画布几何与手势规则 | 交互计算；不决定业务路由 |
| `src/presentation/ui/` | Astro/React 页面、HTML 入口、组件、浏览器运行时和样式 | 向内层读取投影并发出意图 |
| `src/animation/` | 相机、书本和页面投影过场 | 契约与参数；不决定 URL |
| `src/infrastructure/client/` | 浏览器存储适配 | 仅持久化明确允许的字段 |
| `src/infrastructure/server/` | 日记清单与活动 SSE 等服务端适配 | 契约和数据 |
| `src/justin-kit/` | 可复用的桌面、窗口、活动徽章和背景组件 | 不导入本站业务层 |

`src/content.config.ts` 和 `src/env.d.ts` 留在 Astro 约定的位置。`public/os-desktop/` 是桌面文件内容的唯一来源。`games/` 当前保留扩展说明，`src/content/games.json` 是空登记清单，尚无游戏运行时。

## 主要调用链

1. `src/content/site/*.json` → `src/data/repositories/site.ts` → `src/data/selectors/studioFiles.ts` 与 `portfolio.ts` → 工作室文件盒、文件阅读视图和作品页。更换内容模型时修改 repository 适配和契约；展示组件消费派生数据。
2. Three.js 物件与可访问的 HTML 入口都发出 `StudioIntent`。`src/application/studio/resolveIntent.ts` 决定导航或场景操作；`src/app/navigation.ts` 决定 URL 和历史；`src/animation/` 与 `ScenePort` 执行可取消过场。每次导航开始即更新 URL，过场使用 token 拒绝旧完成回调。
3. `src/content/canvas/published.ts` → canvas repository → ReactFlow 展示。`src/contracts/canvas.ts` 不包含 ReactFlow 类型；`flowTypes.ts` 是展示层适配。`canvasPositions.ts` 只解析并保存同 ID 卡片的 x/y，清除站点数据后恢复发布布局。
4. `src/content/journal/*.md` → 生成专用 HTML/锚点 → 固定分页 → 不可变版本包。`current.json` 唯一激活，客户端只携带元信息、页映射与点击区域。普通 `dev`/`build` 无 Chromium 校验已有包；开发失配报告状态，生产失配失败。生成失败不改变上一份激活包。
5. `public/os-desktop/` → Justin Kit 扫描器 → 文件图标与窗口。组件运行时按内容渲染、窗口位置、手势拆分；站点活动 API 使用 `src/data/stores/activity/` 和 `src/infrastructure/server/activityStream.ts`，Kit 状态徽章只消费公开快照。

## 变更与验证

- 改简历、作品或文件顺序：编辑 `src/content/site/`，运行 `test:unit`、`build` 和相关浏览器流程。
- 改画布发布内容：使用 `justinspace-canvas-content`，保持卡片 ID 和边端点有效，并验证本地位置恢复/重置。
- 改模型：保持 `ScenePort`；对照相同相机、视口和光照的重构前后画面，并检查 WebGL 失败入口及 GPU 释放。
- 改过场：只改 `src/animation/` 或场景实现，检查中断时的 URL、返回、监听器和资源状态。
- 改日记：先 `journal:build` 生成书页，再用 `journal:verify` 和 `build` 验证源、当前版本及 dist 一致；异常路径用隔离目录测试。

`check:boundaries` 使用 TypeScript 与 Astro AST，检查逆向导入、运行时循环、纯层平台访问，以及浏览器入口到 Node/服务端模块的传递链；`test:boundaries` 包含必须失败的违规夹具。`test:unit`、`check:types`、`build`、`build:release` 与 `test:e2e` 分别验证规则、类型、已有包构建、分页发布和真实浏览器行为。Docker 构建需要可用的 daemon，无法运行时单独报告。

## 状态和资源所有权

工作室实例 Store 持有灯、时钟、抽屉和稳定视角目标。scene 接受幂等设置并持有实际 Mesh/插值。日记 application 控制器负责文章、书签和进入退出；交互层解释 pointerId 与手势；动画层只采样活动时间；场景负责纹理工作集和有效绘制报告。取消返回独立结果，不能触发完成后的导航或书签写入。

站点资料统一在 `src/content/site/site.json`，repository 验证后由纯 selector 派生页面标题。`src/app/siteContent.ts` 将完整阅读记录和精简的模型标签分别组装，Three.js 不读取站点记录。
