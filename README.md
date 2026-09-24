# JustinWeb

一个个人网站，包含三维工作室、作品集、桌面、画布和日记。

## 功能

- `/home`：可交互的 Three.js 工作室。
- `/works`：项目作品和简历。
- `/canvas`：可拖动浏览的 ReactFlow 画布。
- `/os`：文件驱动的桌面与窗口。
- `/journal`：带实体翻页效果的日记。

## 本地运行

需要 Node.js `>=22.12.0`。

```bash
npm ci
npm run dev
```

## 活动监听器 CLI

全局安装和配置仅支持 macOS：

```bash
npm run monitor:install
justin-activity config
justin-activity restart
justin-activity status
```

首次配置时输入上报地址和 token；之后可用 `justin-activity config --show` 查看配置状态。

常用命令：

```bash
justin-activity start
justin-activity stop
justin-activity restart
justin-activity autostart on
justin-activity autostart off
justin-activity logs
justin-activity logs --follow
justin-activity doctor
justin-activity uninstall
justin-activity uninstall --purge
```

项目内临时运行监听器：`npm run monitor:activity`。更多安装与配置细节见[监听器说明](src/justin-kit/components/local-activity-status/README.md)。
