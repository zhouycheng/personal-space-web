# 快捷键系统

`src/justin-kit/runtime/shortcuts.ts` 为每个文档维护共享快捷键实例。应用层注册页面导航，组件注册自身操作；键盘动作与按钮共用现有控制器、关闭函数和导航流程。

## 退出与现有按键

| 界面 | Esc |
| --- | --- |
| Justin OS | 返回首页，保留打开的窗口及桌面状态 |
| 画布 | 先关闭内容列表并恢复焦点；列表关闭后返回首页 |
| 文件夹 | 依次关闭下载菜单、作品详情，再返回首页 |
| 日记 | 依次关闭插图、合书、返回首页；准备、错误和过场期间可取消退出 |
| 探索面板 | 关闭并恢复探索按钮焦点 |
| 钓鱼 | 结束活动，恢复进入前视角与焦点 |
| 临时调试面板 | 关闭面板；开发常驻模式沿用常驻规则 |
| 3D 首页 | 单按保持首页；400ms 内双按推远镜头并返回云雾入口，底部显示「点击拨开云雾」 |

日记保留 Enter／Space 开书、方向键／PageUp／PageDown 翻页、`+`／`=`／`-` 缩放及 `0`／Home 重置视角。文件夹保留方向键和 Home／End 切换文件，画布保留 Enter／Space 聚焦卡片，探索页签保留方向键和 Home／End 切换，云雾入口保留 Enter／Space 进入，OS 文件夹保留 Enter 打开条目。场景调试热角读取同一系统的修饰键状态。

## 注册与扩展

组件取得 `getShortcutSystem(root.ownerDocument)`，创建作用域并注册命令：

```ts
const scope = getShortcutSystem(root.ownerDocument).createScope({
  id: 'reader', owner: root, signal: events.signal,
  enabled: () => reader.active,
});
scope.register({
  id: 'next', description: '下一页', keys: ['ArrowRight', 'PageDown'],
  when: () => reader.ready, repeat: true,
  run: () => reader.next(),
});
```

- `createScope` 接受 `id`、DOM 所有者 `owner`、`kind`、初始 `active`、动态 `enabled` 和清理信号 `signal`。`kind` 为 `page`、`overlay`、`modal`、`global` 或 `startup`。弹层打开时调用 `setActive(true)`，关闭时调用 `setActive(false)`。
- `register` 接受稳定命令 ID、说明、按键、启用条件和动作，返回注销函数。同一作用域中的重复 ID 会报错。`dispose` 释放整个作用域；组件的 AbortSignal 也可统一清理。
- 字符串按键精确匹配 `event.key`，`Space` 对应空格。组合键使用 `{ key: 'K', mod: true, shift: true }`；`mod` 在 macOS 对应 ⌘，其他平台对应 Ctrl。Ctrl、Meta、Alt、Shift 可单独声明，`shift: 'any'` 用于兼容主键盘和数字键盘的 `+`。
- `allowInEditable` 默认关闭；Esc 关闭命令显式开启。组合输入、已消费事件及原生 select／combobox 留给控件处理。`repeat` 默认关闭，连续翻页和缩放显式开启。
- `presses: 2` 声明 400ms 内双按。长按重复不计数；其他按键、弹层关闭、作用域启停、失焦和后台挂起清除首按记录。首页返回入口用这一声明注册，动画中停止响应。
- 模态作用域隔离后台命令；嵌套弹层从内向外处理，同层优先最后激活的作用域。命令执行前消费事件，关闭动画期间和长按均不会沿同一次事件继续退出页面。原生 `dialog.cancel` 复用组件的关闭函数。
- 按键提示同步维护 `aria-keyshortcuts` 与按钮提示。原生按钮激活、Tab 焦点管理及 ReactFlow 内建节点操作由组件维护。

## 生命周期与嵌入内容

系统在首个消费者注册时安装文档级监听，最后一个消费者释放后移除监听。隐藏、inert、脱离文档的作用域以及后台、BFCache 挂起的文档停止响应；恢复沿用原有注册。

启动覆盖层仍在准备内页时，Esc 将导航目标改为首页，并通过入口准备流程取消旧的阅读操作。首次入站仍保留云雾入口的进入步骤。

首页双按 Esc 复用开场轨迹反向返回，云雾使用同一活动时钟回拢；返回期间保留底部就绪提示并隐藏进度条。场景与路由保留，点击或 Enter／Space 再次拨开云雾。入口组件在每次进入完成后释放，再次返回时重新创建。

`observeModifiers` 订阅修饰键状态，在 keyup、失焦、后台和挂起时复位。场景调试面板通过应用层注入的键盘端口接入，Three.js 场景继续遵守自身依赖边界。

`attachFrame` 连接同源 iframe 的文档，在内部控件和弹层处理后，将未消费的 Esc 交给宿主。重新加载会断开旧文档；桌面内容活动状态控制转发，关闭窗口释放连接。跨域内容使用宿主的退出入口。

画布退出前通过 `canvas:finish-drag` 收尾活动拖拽，用现有位置保存路径提交最后显示的位置。保存范围仍为卡片 ID 与位置。

## 验证

内核行为由 `tests/shortcuts.test.mjs` 覆盖；`tests/e2e/shortcuts.spec.ts` 覆盖页面与弹层退出、已有快捷键、iframe、拖拽、焦点和生命周期。原生 dialog、iframe 和窄屏内容列表同时选择 Chromium 与 WebKit 定向验证。
