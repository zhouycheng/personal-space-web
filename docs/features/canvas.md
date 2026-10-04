# 我的画布

画布使用 ReactFlow 展示仓库维护的卡片和连线。发布内容唯一来源是 `src/content/canvas/published.ts`，经 `src/data/repositories/canvas.ts` 读取；Agent 通过项目技能 `justinspace-canvas-content` 修改内容、默认布局、样式和卡片组件，构建发布后生效。

## 浏览与位置

- 网页不提供内容编辑、作者登录、上传、尺寸或连线编辑。
- 直接拖动卡片调整位置，无额外把手。浏览器仅在 `justin-canvas-positions-v1` 保存被移动卡片的 ID 与 x/y。
- 本地位置覆盖同 ID 的默认位置；新增卡片采用默认位置，已删除 ID 忽略。内容始终来自网站。
- 恢复默认布局清除本地覆盖。清除站点数据、首次访问或存储不可用时采用默认布局。
- 缩放与视角仅保留在当前页面会话的内存中，不写入浏览器存储。首次获得有效尺寸时适配内容；离开后返回恢复同一视角。刷新页面重新适配，点击“查看全图”可以重新适配当前内容。
- 双击卡片聚焦，双击空白区域查看全图；键盘 Enter/空格聚焦节点。内容直接在节点展示，没有阅读面板。
- 手机内容列表收进抽屉，点击条目定位卡片。空白区域平移，双指缩放。

## 内容与资源

不依赖 ReactFlow 的内容类型见 `src/contracts/canvas.ts`，ReactFlow 适配类型在 `src/presentation/ui/canvas/flowTypes.ts`，只读渲染器为同目录的 `CanvasCardContent.tsx`。HTML 字段只接受经审核的仓库内容。图片放在 `public/canvas/`。自定义卡片通过扩展类型和 React 渲染器实现。

画布没有数据库、服务端会话、修订保存 API 或备份服务。健康接口检查静态画布结构及桌面内容。

动态状态通过同源 `/api/activity/stream` 接收事件，区分加载、在线、离线和请求失败；到期的快照不再显示为在线。画布卡片与 Kit 状态组件共享按消费者计数的连接，最后一个活动消费者退出时关闭连接。`/api/activity/current` 仍供其他调用方读取快照。

## 模块生命周期与渲染

- `MineCanvasLoader.tsx` 首次进入时加载重组件。离页立即暂停活动订阅、尺寸观察与输入；离开 60 秒后卸载编辑器。再次进入按内存中的视角和卡片位置恢复，持久化范围仍只有卡片位置。
- `canvasSession.ts` 描述加载器持有的内存状态；`canvasActivityContext.ts` 将活动状态传给卡片。后台和 BFCache 挂起时暂停副作用，恢复时重新判断路由。
- `MineCanvasEditor.tsx` 每次挂载只读取一次保存的位置。`derivedEdges.ts` 维护节点索引和邻接关系，只重算位置或尺寸变化节点关联的端点；未改变的连线复用对象。`CanvasViewControls.tsx` 单独订阅缩放值，缩放标签更新不重新派生卡片与边。
- 卡片拖动结束后才写入位置。坏数据单项回退，写入失败仍保留当前页面会话中的位置。恢复默认布局清除位置覆盖并重新适配内容。

`tests/e2e/ui-lifecycle.spec.ts` 检查离页连接关闭、闲置卸载、视角恢复和位置存储边界。定量对比使用 `scripts/ui-performance-measure.mjs`；原始测量与冻结预算保存在 `.workspace/remediation/ui-probes/`。
