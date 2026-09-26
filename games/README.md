# 游戏扩展位

本轮仅保留登记入口。`src/content/games.json` 是当前发布清单，空数组表示没有已发布游戏。游戏将来需独立说明运行环境、内容授权和测试方式，再接入站点。

`src/contracts/games.ts` 定义纯类型 `GameDefinition`（包含 `entryUrl`）和异步 `GameLauncher.open/close`。清单保持为空；本站没有实现启动器、游戏宿主、菜单、模型或语言工具链。
