# Symbol Dome Background（符号半球背景）

分类：`JS Motion`

状态：Astro 提取完成，已挂载到 Justin OS 桌面背景，替换原星星层。

这是从 `terminal-symbol-dome-single-face-v3.html` 草图吸收的符号半球背景。它用 Canvas 绘制单面右转的半球：海洋由 `%` 和 `x` 组成，陆地由同尺寸 `#` 组成，并通过主题黄色、透明度和位置区分。

## 文件

- `SymbolDomeBackground.astro` 渲染背景容器和 Canvas。
- `symbol-dome-background.css` 提供层级、铺满和动效偏好回退。
- `symbol-dome-background.ts` 负责采样点、单面右转、海洋轻微闪动和鼠标轻微朝向。
- `source-notes.md` 记录吸收的草图来源。

## 用法

```astro
---
import SymbolDomeBackground from "/src/justin-kit/components/symbol-dome-background/SymbolDomeBackground.astro";
---

<div class="desktop-surface">
  <SymbolDomeBackground />
</div>
```

宿主容器应为 `position: relative` 或同等定位上下文。组件本身 `pointer-events: none`，不会阻挡桌面图标、菜单或窗口交互。

## 行为

- 半球持续缓慢向右旋转，不由鼠标改变旋转方向。
- 鼠标存在时，半球整体会非常轻微地朝向鼠标偏移。
- 鼠标附近的符号会变小、颜色向主题黄色靠近并降低透明度。
- 海洋字符保留轻微闪动；陆地区域保持更稳定。
- `prefers-reduced-motion: reduce` 时停止旋转，但仍绘制静态半球。

## 集成检查清单

- 背景放在桌面图标和窗口层下方。
- 不修改宿主的纯克莱因蓝背景。
- 不捕获指针事件。
- 更新 `src/data/kit.ts` 后，组件库目录可以发现该组件。
