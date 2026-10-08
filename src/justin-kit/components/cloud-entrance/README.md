# Cloud Entrance

原生 Canvas 2D 准备页：云雾、底色和文字颜色随访客本地时间在夜色、晨光、白昼和暮色间平滑变化，标题与单行状态绘制在同一 Canvas 上；底部细进度条以连续水光和柔和前沿表现真实准备阶段，并支持局部悬停散雾和揭幕。组件使用确定性噪声生成雾面，标题采用设备的 Georgia / serif 字体；隐藏的 `aria-live` 状态节点供辅助技术读取，进度条同步暴露真实阶段值，错误按钮和入口链接保留原生交互。站点加载、会话、路由和相机由宿主管理。

```astro
---
import CloudEntrance from './CloudEntrance.astro';
---
<CloudEntrance title="Justin" loadingText="正在准备小岛" readyText="点击拨开云雾">
  <p data-cloud-no-enter>个人介绍，可以选中文字。</p>
  <a href="/about">关于我</a>
  <a slot="fallback" href="/works">查看作品</a>
</CloudEntrance>
```

由宿主创建 `createCloudEntrance(root, onEnter, onRetry, initialPalette?)`，调用 `setProgress(0..1)`、`setState('loading' | 'ready' | 'revealing' | 'dismissing' | 'error', message?)`、`setRevealProgress(0..1)`、`setPalette(palette)`、`dismiss(duration)`、`dispose()`。组件会同步生成自己的噪声与画布，不会自行判断场景就绪或启动场景动画；宿主必须单独防止重复进入、传入活动时钟进度，并在成功后交接焦点。

默认加载文字为「正在加载场景」。宿主可通过 `setState('loading', message)` 替换当前阶段文字；阶段定义、耗时记录和错误重试由宿主持有。`setProgress` 表示宿主任务的完成节点，不自动推算下载字节或剩余时间。

进度条仅在 `loading` 可见。点击就绪提示后，文字沿揭幕进度的前 14% 逐渐模糊消散，与现有云雾、相机动画使用同一时钟；揭幕和刷新淡出期间不会重新显示进度条。减少动态效果时立即隐藏就绪提示。

4px 进度条的完成长度通过 `scaleX` 在 800ms 内衔接真实目标；两道独立水纹仅动画 `transform` 和 `opacity`，周期 2.4 秒、相差半周期、最高透明度 0.25。水纹不引用进度目标，阶段更新不重启流水。宿主应在同步初始化前提供首帧绘制机会，让浏览器提交合成动画；主线程忙碌时只能延续已提交的动画，新阶段仍需等待事件处理。合成加速需在目标浏览器验证，GPU 拥塞仍可能影响画面。非加载、页面隐藏和销毁时停止水纹并释放 `will-change`；减少动态效果同时覆盖元素与伪元素。Canvas 不为流水启动持续 RAF。

`loading` 和 `ready` 使用同一个底部状态节点作为无障碍文案，Canvas 负责可见文字。状态文字使用昼夜调色板中的高对比前景色；阶段文案只在真实阶段切换时更新，进度条平滑过渡到宿主给出的阶段值，并在等待期间持续流动。进度条不推算下载量或剩余时间。就绪时进度条收起，提示原位替换。首次进入使用 `ready` 等待用户点击，再由场景时钟驱动 `revealing`。已完成标签页刷新时，宿主继续传入真实准备进度，准备完成后调用 `dismiss(duration)` 自动淡出云雾，不启动相机开场动画。错误状态显示重试和注入的 `fallback` 插槽；错误说明由 Canvas 绘制，按钮和链接仍由 DOM 承载。按钮、链接、表单、`contenteditable`、`data-cloud-no-enter`、文字选区和移动超过 6px 的拖动均不会触发进入；就绪根节点支持 Enter / Space。

`fogField.ts` 将多尺度平滑噪声和坐标扭曲预计算为数值密度缓冲；横向拉伸的三层云纱以不同尺度与速度采样，不计算凸起表面法线。准备页使用揭幕进度为零的同一画面，字形在尺寸改变时烘焙。悬停只揭开另一层不透明雾面；点击前不会暴露底层内容。

独立使用时，`timePalette.ts` 根据浏览器本地时钟在夜间、清晨、白天和傍晚调色板间平滑插值，每分钟检查时钟并在恢复可见时更新。传入 `initialPalette` 时关闭组件内时钟，由宿主调用 `setPalette`，同一配色用于准备雾面、文字和揭幕云体；相同配色不重绘。站点用这一接口注入真实时间和观测经纬度计算的颜色，因此加载与场景共用天色。CSS 首屏可从 `--environment-background`、`--environment-foreground` 继承宿主提前设置的颜色。

揭幕时三层云纱缓慢错位漂移，中央先变薄，扰动后的柔软边缘逐渐向外围退散。透明度由叠加光学厚度计算，明暗采用低对比透射光。低分辨率计算画布按视口比例生成，最大 384×288，复用像素缓冲并平滑缩放；不叠加上一帧残影。采样由宿主的相机进度驱动，静置无持续 RAF。隐藏页面暂停，BFCache 保留；`dispose()` 解除观察器/监听器、取消帧、清空 Canvas、像素与数值场缓冲并隐藏组件。

独立预览由 `tests/e2e/entrance.spec.ts` 的 standalone 检查生成在 `.workspace/entrance-validation/standalone.html`，可直接打开，无需海岛。该预览的模拟状态只用于组件验证；站点由 `src/app/entranceRuntime.ts` 接入真实准备流程。
