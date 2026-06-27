# Cursor Reveal Hero（光标揭示英雄）

分类：`HTML`

状态：Astro 提取完成。该组件尚未挂载到当前 Justin OS 启动页。

这是从旧 Next/React 首页提取的圆形遮罩效果，已改造为轻依赖的 Astro 组件。

## 文件

- `CursorRevealHero.astro` 渲染双层英雄区域。
- `cursor-reveal-hero.css` 包含遮罩、点阵、排版和回退样式。
- `cursor-reveal-hero.ts` 跟踪指针移动并动画化 CSS 变量。
- `source-notes.md` 记录提取时参考的旧 Next 源文件。

## 用法

从要渲染该组件的页面或组件中导入：

```astro
---
import CursorRevealHero from "../justin-kit/components/cursor-reveal-hero/CursorRevealHero.astro";
---

<CursorRevealHero
  primaryLeading="你好，我是"
  primaryAccent="耀程"
  primarySubtitle="Flutter engineer building personal tools with AI."
  revealLeading="Hello, I'm"
  revealAccent="Justin"
  revealSubtitle="A second layer appears through the cursor mask."
/>
```

该组件不依赖 React。它使用原生指针事件、`requestAnimationFrame` 和圆形 CSS `clip-path`。

## Props

- `primaryLeading`：主要强调文字前的文本。
- `primaryAccent`：主要层中强调的文字。
- `primarySubtitle`：主要层中的副标题。
- `revealLeading`：揭示强调文字前的文本。
- `revealAccent`：揭示层中强调的文字。
- `revealSubtitle`：揭示层中的副标题。
- `class`：添加到根 section 的可选类名。

## 行为

- 桌面精细指针获得圆形揭示遮罩。
- 指针按下时轻微缩小揭示半径。
- 触屏设备和偏好减少动效的用户仅显示主要层。
- 视觉令牌是组件本地的，后续可替换为 Justin Kit 设计令牌。

## 集成检查清单

- 直接导入 Astro 组件；无需 React 运行时。
- 保持组件 CSS 本地化，除非设计令牌被提升到 Justin Kit。
- 如果渲染多个实例，初始化器可以安全地多次调用，因为它用 `data-cursor-reveal-bound` 标记已绑定的元素。
