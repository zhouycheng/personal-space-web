# Cloud Entrance

原生 Canvas 2D 准备页：云雾、底色和文字颜色随访客本地时间在夜色、晨光、白昼和暮色间平滑变化；保留陷入云中的模糊文字、单行文字进度、局部悬停散雾和揭幕。不依赖 Three.js、站点数据或路由。没有云雾图片素材或下载、解码步骤。

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

由宿主创建 `createCloudEntrance(root, onEnter, onRetry)`，调用 `setProgress(0..1)`、`setState('loading' | 'ready' | 'revealing' | 'dismissing' | 'error', message?)`、`setRevealProgress(0..1)`、`dismiss(duration)`、`dispose()`。组件会同步生成自己的噪声与画布，不会自行判断场景就绪或启动场景动画；宿主必须单独防止重复进入、传入活动时钟进度，并在成功后交接焦点。

`loading` 和 `ready` 使用同一个底部文本节点。加载文字的颜色从左向右填充；就绪文字原位替换。首次进入使用 `ready` 等待用户点击，再由场景时钟驱动 `revealing`。已完成标签页刷新时，宿主继续传入真实准备进度，准备完成后调用 `dismiss(duration)` 自动淡出云雾，不启动相机开场动画。错误状态显示重试和注入的 `fallback` 插槽。按钮、链接、表单、`contenteditable`、`data-cloud-no-enter`、文字选区和移动超过 6px 的拖动均不会触发进入；就绪根节点支持 Enter / Space。

`fogField.ts` 将多尺度平滑噪声和坐标扭曲预计算为数值密度缓冲；横向拉伸的三层云纱以不同尺度与速度采样，不计算凸起表面法线。准备页使用揭幕进度为零的同一画面，字形在尺寸改变时烘焙。悬停只揭开另一层不透明雾面；点击前不会暴露底层内容。

`timePalette.ts` 根据浏览器本地时钟在夜间、清晨、白天和傍晚调色板间平滑插值。云体以环境亮度变化为主，夜间为低亮度灰色，晨昏仅有轻微冷暖差；散射亮度随环境亮度缩放，避免夜间出现白色高光。组件每分钟检查时钟，并在页面恢复可见时立即更新；重绘准备雾面、文字和揭幕云体时复用同一组颜色。

揭幕时三层云纱缓慢错位漂移，中央先变薄，扰动后的柔软边缘逐渐向外围退散。透明度由叠加光学厚度计算，明暗采用低对比透射光。低分辨率计算画布按视口比例生成，最大 384×288，复用像素缓冲并平滑缩放；不叠加上一帧残影。采样由宿主的相机进度驱动，静置无持续 RAF。隐藏页面暂停，BFCache 保留；`dispose()` 解除观察器/监听器、取消帧、清空 Canvas、像素与数值场缓冲并隐藏组件。

独立预览由 `tests/e2e/entrance.spec.ts` 的 standalone 检查生成在 `.workspace/entrance-validation/standalone.html`，可直接打开，无需海岛。该预览的模拟状态只用于组件验证；站点由 `src/app/entranceRuntime.ts` 接入真实准备流程。
