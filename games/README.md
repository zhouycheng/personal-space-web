# 游戏扩展位

`src/content/games.json` 是游戏登记清单，当前为空数组，没有已发布游戏。

`src/contracts/games.ts` 定义纯类型 `GameDefinition`（包含 `entryUrl`）和异步 `GameLauncher.open/close`。这组接口是保留的扩展入口，尚未接入游戏启动器、宿主或菜单。
