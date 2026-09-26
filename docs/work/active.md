# 当前项目状态

仓库版本为 `1.1.0`。当前维护事实以源码、`README.md`、`CONTEXT.md` 和功能文档为准；日期化的变更摘要统一保存在根目录 [`CHANGELOG.md`](../../CHANGELOG.md)。

## 路由和职责

- `/`、`/home`：Three.js 工作室；`/works`：作品和简历；`/canvas`：个人画布；`/os`：Justin OS；`/journal` 与 `/journal/[slug]`：实体 3D 日记。
- `src/app/` 负责依赖组装、URL 与应用生命周期；`src/application/` 决定用户意图；`src/animation/` 负责可取消的时间采样；`src/presentation/` 负责 UI、输入和 Three.js 场景。
- `src/content/` 是发布内容来源；repository 校验读取，selector 负责派生。访客本地状态包括画布卡片位置、窗口布局及阅读书签。
- Justin Kit 保持通用组件边界；Justin OS 的文件内容由 `public/os-desktop/` 提供。

## 已确认的体验约束

- 工作室保留桌椅模型、电脑、平板和完整镜头过场。日夜氛围按访客本地时间变化；夜间环境接近黑色，台灯柔和照亮桌面，屏幕与平板自行发光，咖啡蒸汽随夜色收敛。
- 使用原生鼠标指针；悬停文字固定为白色并显示在指针下方，模型高亮保持轻微。
- 日记只使用 3D 书页。合拢时底部只保留提示；阅读时只保留“合拢”和当前页 / 总页数，提示放在合拢文字下方。书本返回抽屉时从当前角度连续归位。
- 画布发布内容不由访客覆盖；只保存被移动卡片的位置。完整路由、内容和交互约束见功能文档。

## 检查和未验证范围

- 常用检查：`npm run test:unit`、`npm run check:boundaries`、`npm run check:types`、`npm run build`。
- 日记分页与产物：`npm run test:journal:render`、`npm run journal:verify`；完整发布构建使用 `npm run build:release`。
- 浏览器交互：`npm run test:e2e` 使用已构建站点；该命令不代替真机触摸检查。
- 早前 B1/B2 性能数据采集时使用的是较低分辨率页图，需在当前页图下重新测量内存峰值。普通手机性能、真实 iOS Safari/微信以及最终部署需相应设备或环境证据。
- 已知依赖审计事项见 [`docs/work/backlog.md`](backlog.md)；未经单独回归不批量升级。
