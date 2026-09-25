# 本地活动状态

macOS 前台应用采集、网站活动接口和状态展示。全局工具与项目开发脚本共享采集和上报实现。

## 全局安装

在仓库根目录使用 .node-version 对应 Node：

```bash
rtk npm run monitor:install
justin-activity config
justin-activity restart
justin-activity status
```

安装无需 sudo。程序复制到 ~/Library/Application Support/JustinActivity/，命令位于 ~/.local/bin/justin-activity。安装后可以移走仓库；仍需要安装时记录的 Node 绝对路径有效。首次安装启用当前用户登录自启并启动服务，配置缺失会显示明确错误。重复安装保留配置、自启选择和故障通知进度；原来停止的服务保持停止。

如果命令不在 PATH，按安装输出将 ~/.local/bin 加入自己的 shell 配置。脚本不会修改 shell 文件。配置文件权限为 0600，安装目录为 0700。不要将这些文件提交到 Git。

首次使用时运行 `config`，输入上报地址和网站的 `ACTIVITY_MONITOR_TOKEN`。Token 使用隐藏输入；`config --show` 显示上报地址和 token 是否已配置，不显示 token。也可在保存上报地址后，用 `config --import-env /path/to/.env` 导入 token。配置修改后运行 `restart`。

## 命令

| 命令 | 行为 |
| --- | --- |
| start / stop / restart | 当前运行控制；不改变登录自启 |
| autostart on / off | 控制下次登录，不改变当前进程 |
| status | LaunchAgent 注册、进程、采集、上报、最近成功和故障提醒时间 |
| config / config --show | 交互配置 / 脱敏查看 |
| logs / logs --follow | 查看最近日志 / 持续跟踪 |
| doctor | Node、配置、注册状态和当前终端采集权限诊断 |
| notify-test | 请求一次 macOS 测试通知 |
| uninstall | 停止并移除程序、自启；保留配置与日志 |
| uninstall --purge | 同时删除工具自己的配置、状态和日志 |

LaunchAgent 使用 cn.zhoust.justin-activity 标签；意外退出由 launchd 重启，节流 30 秒。stop 卸载当前作业，因此不会被 KeepAlive 拉起；保留的登录 plist 会在下一次登录加载。关闭自启仅删除登录入口，手动 start 从独立 plist 启动。单实例锁避免重复后台采集。

状态、通知进度和日志位于安装目录；日志约 1 MB 轮转并保留一份旧日志。状态中的时间为 Unix 毫秒，lastSuccess 为 ISO 时间，stale 表示心跳超过 25 秒未更新。registered 不代表健康，需同时查看 running、stale、capture、upload 和 incident。

## 错误与通知

采集权限、采集失败、网络、超时、401/403、服务端错误分别记录；失败不会推进成功心跳。故障原因变化合并到同一轮通知：

1. 连续失败 10 分钟首次通知。
2. 再等待 30、60、90 分钟，此后每 90 分钟提醒。
3. 进度持久保存；重启不补发积压通知。
4. 采集与上报连续正常 60 秒结束故障轮次；休眠跨越心跳期限会重新计算连续健康时间。
5. 主动 stop 结束当前故障轮次，不再通知。

通知只包含错误类别与查询命令；不包含当前应用名或密钥。通知调用失败只记日志。系统通知权限、勿扰模式可能阻止可见弹窗；notify-test 成功仅表示请求提交，仍需人工确认通知出现。

读取前台应用使用 System Events。按 macOS 提示允许自动化/辅助功能权限；终端与 LaunchAgent 的权限上下文可能不同，以后台 status 的结果为准。doctor 不修改系统授权。Node 被删除时服务无法运行和发送通知，需恢复 Node 并重新安装；status/launchctl 可用于排查。

## 项目开发

```bash
rtk npm run dev
rtk npm run monitor:activity
```

项目脚本读取 .env.local、.env 或进程环境，支持 ACTIVITY_MONITOR_URL（默认本地）、ACTIVITY_MONITOR_EXTRA_URLS 和 token。不要同时让全局监视器和开发脚本向同一网站上报；测试使用本地接收端和隔离配置。

## 数据流与接口

macOS 前台应用 → POST /api/activity/update → `src/data/stores/activity/` 内存 TTL → GET /api/activity/current 或 SSE /api/activity/stream → 画布/徽章。

本站 update/current 路由使用同一活动存储，stream 由 `src/infrastructure/server/activityStream.ts` 提供。Justin Kit 的状态徽章只消费公开快照，监控 CLI 负责采集与上报；本站文案规则在 `src/data/selectors/activityText.ts`，Kit 不依赖本站业务文件。

POST 载荷：{ appName, state: "active" | "inactive", observedAt, sessionId }；Bearer token 鉴权。GET current 返回有效快照或 null。采集 2 秒，上报心跳 12 秒，请求超时 4 秒，服务端 TTL 25 秒。正常停止尽力发送 inactive，失败时等待服务端过期。

生产接口从 process.env 在运行时读取 token，避免在构建时固化缺失配置。修改服务器 token 后需重建容器使新环境变量生效，无需重新构建镜像。开发模式兼容 Astro 的本地环境文件。

上报优先使用 Node HTTPS；macOS 遇到证书链构建错误时使用系统 curl 验证和发送，始终启用证书校验。curl 凭据通过标准输入传递，不出现在命令参数中。

安装验证与故障模拟不需要向生产接口发送虚构活动。完整登录自启和通知可见性需在真实用户会话验证。
