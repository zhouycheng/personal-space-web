# 源码备注

原始 Next 实现仅在 refs/effects 中使用 React state。视觉行为主要通过 CSS 变量实现：

- `--cursor-x`
- `--cursor-y`
- `--cursor-radius`
- `--cursor-scale`
- `--cursor-opacity`

在 Astro 中，可以通过将指针移动直接绑定到元素并更新 `--x` / `--y` 来简化组件。

需要保留的重要行为：

- 在粗略指针设备上隐藏揭示层，
- 尊重 `prefers-reduced-motion`，
- 避免在活动英雄区域之外劫持光标，
- 保持主要层和揭示层内容为真实 HTML 以保证无障碍访问。

当前 Astro 实现：

- `CursorRevealHero.astro` 渲染静态语义化标记。
- `cursor-reveal-hero.css` 拥有层级样式和遮罩行为。
- `cursor-reveal-hero.ts` 将指针事件绑定到每个 `[data-cursor-reveal-hero]` 元素，并通过 `requestAnimationFrame` 更新 CSS 变量。

旧 Next 文件已不再属于活跃工作树。
