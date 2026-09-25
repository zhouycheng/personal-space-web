# macOS 桌面

Justin OS 桌面投影的可复用 Justin Kit 组件。

## 用法

```astro
---
import MacOsDesktop from "/src/justin-kit/components/macos-desktop/MacOsDesktop.astro";
import { getMacOsDesktopEntries } from "/src/justin-kit/components/macos-desktop/runtime/desktop-scanner";

const entries = await getMacOsDesktopEntries();
---

<MacOsDesktop entries={entries} />
```

### 嵌入式窗体

作品预览等静态内容可复用同一套窗体外观，而不启用桌面的拖动、缩放和持久化运行时：

```astro
---
import MacOsWindowFrame from "/src/justin-kit/components/macos-desktop/MacOsWindowFrame.astro";
---

<MacOsWindowFrame ariaLabel="软件预览" title="预览窗口" kind="App">
  <div>窗口内容</div>
</MacOsWindowFrame>
```

省略 `title` 和 `kind` 时保留无文字标题栏。可通过 `titlebar-actions` 命名插槽添加纯展示的标题栏内容；三色控制点在嵌入式窗体中不进入键盘焦点。

## 桌面目录

默认扫描器读取：

```text
public/os-desktop/
```

支持的项目：

- `.html`：在 iframe 支持的窗口内打开。
- `.md`：在 Markdown 支持的窗口内打开。
- 文件夹：以 Finder 风格窗口打开，并递归扫描。

忽略的项目：

- 以 `.` 开头的隐藏文件和文件夹
- 不支持的文件扩展名

文件和文件夹名称即为桌面名称。文件扩展名通过图标角标表示，而不是桌面标签。

## 行为

- 图标默认为 `48px`，标签为 `8.5px`。运行时暴露 CSS 变量用于图标图形大小、标签大小和计算后的拖拽目标。
- 新布局从右侧开始，向下排列，然后向左。
- 拖拽后的图标位置持久化到 `localStorage`。
- 显示设置持久化到 `justin-os-desktop-view-settings`。
- 手动调整的窗口尺寸持久化到 `justin-os-window-sizes`。全屏框架和自动视口裁剪不会被保存。

`MacOsDesktop.astro` 只输出桌面结构；`runtime/desktopRuntime.js` 管理图标和窗口生命周期，`desktopContent.js` 渲染文件内容，`windowFrames.js` 与 `windowGestures.js` 处理窗体几何和手势，`desktopPersistence.js` 负责浏览器本地设置和图标位置。
- 重叠的图标通过 FLIP 弹跳动画推开。
- 背景挂载 `symbol-dome-background`，在图标、窗口和菜单下方绘制符号半球。
- 组件监听以下事件：
  - `justin-os-desktop:clear-windows`：清除打开的窗口，不重置图标位置。
  - `justin-os-desktop:open-display-controls`：打开显示设置窗口。
  - `justin-os-desktop:arrange-icons`：将所有图标动画移回右侧并保存该布局。
