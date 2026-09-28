# 部署手册

生产环境使用 Docker Compose 运行 GHCR 发布的镜像。日常开发和提交默认使用 `develop`；将 `develop` 的 PR 合并到 `main` 后，GitHub Actions 执行检查、构建不可变镜像摘要，通过 Tailscale SSH 部署，并检查容器健康和公开页面。推送到 `develop` 不会部署。服务器 Nginx 提供 HTTPS，应用端口只绑定到本机回环地址。

## 首次准备服务器

以下步骤面向 Ubuntu Server。服务器需要可执行 `sudo` 的管理员账号、指向服务器的域名，以及可从公网访问的 TCP 80 和 443 端口。管理和 CI 部署使用 Tailnet；网站继续通过域名和 HTTPS 访问。

### 安装 Docker Engine 和 Compose

按 Docker 官方 Ubuntu 安装方式配置 apt 仓库并安装 Engine 与 Compose plugin：

```bash
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run hello-world
sudo docker compose version
```

参见 [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)。部署账号不要加入 `docker` 组；它只通过受限的 `deployctl` 入口触发部署。

### 安装 Nginx、Tailscale 和 TLS

```bash
sudo apt update
sudo apt install nginx
sudo systemctl enable --now nginx
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale set --advertise-tags=tag:prod --ssh
```

在 Tailnet 策略中允许管理员访问生产服务器。CI 以 `tag:ci` 身份通过 SSH 连接 `tag:prod` 上的 `deploy` 用户。Tailscale SSH 同时受网络 grant 和 SSH policy 控制，参见 [Linux 安装说明](https://tailscale.com/docs/install/linux)和 [Tailscale SSH](https://tailscale.com/docs/features/tailscale-ssh)。

先为域名建立 HTTP 虚拟主机，将示例域名换成实际域名，保存到 `/etc/nginx/sites-available/justinspace`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并申请证书：

```bash
sudo ln -s /etc/nginx/sites-available/justinspace /etc/nginx/sites-enabled/justinspace
sudo nginx -t && sudo systemctl reload nginx
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot 会为 Nginx 启用 HTTPS。确认 HTTPS server block 中也代理到 `127.0.0.1:4321`，并为 `/api/activity/stream` 增加下列设置。活动流需关闭代理缓冲：

```nginx
location = /api/activity/stream {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

运行 `sudo nginx -t && sudo systemctl reload nginx`，再用 `sudo certbot renew --dry-run` 验证续期。安装细节见 [Certbot Nginx 指引](https://certbot.eff.org/instructions?os=snap&ws=nginx)。

### 安装 Compose 文件和受限部署入口

服务器需要一份 root 管理的 Compose 文件。从仓库取得部署配置并安装到固定目录；这份 checkout 用于复制 Compose 和部署脚本，网站仍由 GHCR 镜像运行：

```bash
git clone --depth 1 https://github.com/zhouycheng/personal-space-web.git /tmp/justinspace-setup
cd /tmp/justinspace-setup
sudo install -d -o root -g root -m 0755 /srv/justinspace
sudo install -o root -g root -m 0644 docker-compose.yml /srv/justinspace/docker-compose.yml
```

创建专用 `deploy` 账号（若已存在则保留），安装受限入口和目标 allowlist：

```bash
if ! id deploy >/dev/null 2>&1; then
  sudo useradd --create-home --user-group --shell /bin/bash deploy
fi
sudo passwd --lock deploy
sudo chmod 0700 /home/deploy
sudo install -d -o root -g root -m 0755 /usr/local/sbin /etc/deployctl/targets
sudo install -o root -g root -m 0755 scripts/deploy/deployctl.sh /usr/local/sbin/deployctl
sudo install -o root -g root -m 0440 scripts/deploy/deployctl.sudoers /etc/sudoers.d/deployctl
sudo visudo -cf /etc/sudoers.d/deployctl
sudo install -o root -g root -m 0600 scripts/deploy/targets/justinspace.conf.example /etc/deployctl/targets/justinspace.conf
sudoedit /etc/deployctl/targets/justinspace.conf
```

JustinSpace allowlist 应保留示例中的仓库、registry、Compose 目录、文件、项目名、服务名和镜像变量。Compose 文件与目录由 root 管理，不能由 `deploy` 修改；该账号的 sudo 权限只应包含 `/usr/local/sbin/deployctl`。

将以下权限合并到现有 Tailnet policy，保留已有成员规则：

```json
{
  "grants": [
    { "src": ["tag:ci"], "dst": ["tag:prod"], "ip": ["tcp:22"] }
  ],
  "ssh": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:prod"],
      "users": ["deploy"]
    }
  ]
}
```

## 配置活动监听器密钥

网站运行时从 `ACTIVITY_MONITOR_TOKEN` 环境变量读取 API 密钥。首次部署前，在 `/srv/justinspace/.env` 写入它。同一台服务器后续更新镜像会继续读取这个文件；换新服务器时，从密码管理器恢复同一个值，或生成新值并同步更新 Mac 监听器。

建议用密码管理器生成 32 字节随机值，也可运行 `openssl rand -hex 32` 生成并妥善保存。然后在服务器执行：

```bash
sudo sh -c 'umask 077; touch /srv/justinspace/.env'
sudoedit /srv/justinspace/.env
sudo chown root:root /srv/justinspace/.env
sudo chmod 0600 /srv/justinspace/.env
```

在文件中加入 `ACTIVITY_MONITOR_TOKEN=<生成的随机值>`。不要把密钥提交到 Git、写入镜像或保存为普通 Actions variable。Compose 创建容器时会加载 `.env` 和可选的 `.env.local`。

Mac 首次安装并配置相同的 token：

```bash
npm run monitor:install
justin-activity config
justin-activity restart
justin-activity status
```

在 `config` 中填写站点 HTTPS 地址和服务器上的同一 token；token 使用隐藏输入。安装会为当前 macOS 用户设置登录自启。权限、LaunchAgent、日志和其他命令见[活动监听器说明](../../src/justin-kit/components/local-activity-status/README.md)。

修改服务器 token 后，需重建容器以加载新环境变量。下面的命令先读取当前镜像摘要，再用同一摘要重建容器，无需构建或拉取新镜像：

```bash
image_ref="$(sudo docker inspect --format '{{.Config.Image}}' justinspace)"
sudo env JUSTINSPACE_IMAGE="$image_ref" docker compose \
  --project-directory /srv/justinspace \
  --project-name justinspace \
  -f /srv/justinspace/docker-compose.yml \
  up -d --no-deps --no-build --pull never --force-recreate justinspace
```

之后检查容器状态、应用日志和 Nginx 错误日志：

```bash
sudo docker compose --project-directory /srv/justinspace -p justinspace -f /srv/justinspace/docker-compose.yml ps
sudo docker compose --project-directory /srv/justinspace -p justinspace -f /srv/justinspace/docker-compose.yml logs --tail=100 justinspace
sudo journalctl -u nginx -n 100 --no-pager
curl -fsS http://127.0.0.1:4321/api/health
```

健康接口不验证活动 token；Mac 上还要确认 `justin-activity status` 显示 `upload: 正常`。常规镜像发布不会删除服务器 `.env`；迁移机器时从密码管理器或受控加密配置恢复。仓库当前没有自动分发运行密钥的流程。

## 配置 GitHub Actions 自动部署

在 GitHub 仓库创建 `production` environment，并将允许部署的分支限制为 `main`。在 **Settings → Environments → production → Environment secrets** 设置：

- `TAILSCALE_SERVER`：服务器的 Tailscale IP 或 MagicDNS 名称。
- `PRODUCTION_URL`：站点规范 HTTPS 地址。
- `TS_OAUTH_CLIENT_ID` 和 `TS_AUDIENCE`：Tailscale GitHub OIDC 联邦身份提供的值。

在 Tailscale 创建 GitHub OIDC 联邦身份，issuer 为 `https://token.actions.githubusercontent.com`，只授予 `auth_keys` 并分配 `tag:ci`。使用 GitHub 显示的 environment subject，通过 custom claim rules 限定仓库、`production` environment 和 `refs/heads/main`，再将 Client ID 与 Audience 保存为上述 GitHub secrets。

在仓库 **Settings → Branches** 为 `main` 配置 branch protection rule。要求变更通过 PR 合并并通过 `verify` 检查；审批数设为 0。启用管理员规则执行，不添加绕过者，并禁止强推和删除。`develop` 保持可直接提交。此保护规则保存在 GitHub 仓库设置中，不由本地 workflow 文件控制。

workflow 使用作业级短期 `GITHUB_TOKEN` 发布并拉取 GHCR 镜像。当前 `ghcr.io/zhouycheng/personal-space-web` 镜像公开可拉取。镜像只包含应用构建产物；`.dockerignore` 排除 `.env*`、数据、备份和临时目录。

## 日常发布、检查与回滚

Pull request 会运行 `npm ci`、日记清单检查、边界检查、类型检查、单元测试和生产构建。日常变更推送到 `develop` 后，创建或更新目标为 `main` 的 PR；`verify` 通过后合并。合并会在 `main` 产生 push 事件，GitHub Actions 随后构建并发布固定的 `repository@sha256:...` 镜像摘要，再通过 Tailnet 调用 `deployctl` 更新容器。直接推送 `main` 不受允许。

部署入口只接受 allowlist 中的目标和镜像摘要。registry 凭据通过标准输入传递，在服务器 `/run` 的临时 Docker 配置中短暂保存并在操作结束后清除。入口等待 Docker healthcheck，通过后记录当前和上一镜像；新镜像未通过时恢复上一镜像。首次部署失败时移除新容器。随后 workflow 检查 `/api/health` 及 `/`、`/home`、`/works`、`/canvas`、`/os`；公开检查失败时再次触发回滚。

日常发布只需完成合并。Compose 将应用端口 `4321` 绑定到 `127.0.0.1`，Nginx 代理到容器。部署入口不会清理 Docker 镜像、卷或其他服务。

## 活动监听器排查

监听器在 Mac 上采集前台应用，每 12 秒上报一次心跳；服务端状态 25 秒未更新后过期。运行 `justin-activity status` 查看采集、上传和最近成功时间，`justin-activity logs --follow` 查看错误，`justin-activity doctor` 检查 Node、配置和后台权限。

| 状态或错误 | 检查位置 |
| --- | --- |
| `HTTP 503`，提示 token 未配置 | 服务器 `.env` 是否有 `ACTIVITY_MONITOR_TOKEN`；重建容器后再检查。 |
| `HTTP 401` 或 `403` | Mac 配置与服务器 token 是否一致；修改后分别重启容器和监听器。 |
| 网络连接失败、`HTTP 502` 或上报超时 | Compose 容器状态、Nginx `proxy_pass`、域名 HTTPS 和 80/443 连通性。 |
| 采集权限错误 | macOS“系统设置 → 隐私与安全性”中的自动化或辅助功能权限；以后台 `status` 输出为准。 |

完整数据流、采集间隔和故障通知策略见[活动监听器说明](../../src/justin-kit/components/local-activity-status/README.md)。

## 源码运行

源码运行适合临时验证或有特殊运维要求的环境。需要自行管理 Node、构建依赖、systemd 服务、更新和回滚；生产环境使用上文的 Docker 镜像流程。

先创建运行账号并检出要部署的代码：

```bash
sudo useradd --system --user-group --create-home --home-dir /home/justinspace --shell /usr/sbin/nologin justinspace
sudo install -d -o justinspace -g justinspace -m 0755 /srv/justinspace-src
sudo -u justinspace git clone --depth 1 https://github.com/zhouycheng/personal-space-web.git /srv/justinspace-src
```

将 `.node-version` 指定的 Node.js（当前为 `26.9.0`）安装到系统 PATH，让 `justinspace` 用户可以调用 `node`、`npm` 和 `npx`。在仓库目录安装依赖、安装 Chromium 及其 Linux 依赖，并构建站点：

```bash
cd /srv/justinspace-src
sudo -u justinspace node --version
sudo -u justinspace npm ci
sudo npx playwright install-deps chromium
sudo -u justinspace npx playwright install chromium
sudo -u justinspace npm run build:release
```

`npm run build:release` 会生成日记书页并构建站点。将 `ACTIVITY_MONITOR_TOKEN` 存入 root 所有、权限 `0600` 的 `/etc/justinspace.env`：

```bash
sudo sh -c 'umask 077; touch /etc/justinspace.env'
sudoedit /etc/justinspace.env
sudo chown root:root /etc/justinspace.env
sudo chmod 0600 /etc/justinspace.env
```

建立 systemd unit，让 Node standalone server 监听 `127.0.0.1:4321`。将 `ExecStart` 替换为 `justinspace` 用户实际的 Node 绝对路径，然后保存为 `/etc/systemd/system/justinspace.service`：

```ini
[Unit]
Description=JustinSpace
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=justinspace
Group=justinspace
WorkingDirectory=/srv/justinspace-src
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4321
Environment=JUSTIN_OS_DESKTOP_DIR=/srv/justinspace-src/dist/client/os-desktop
EnvironmentFile=/etc/justinspace.env
ExecStart=/absolute/path/to/node dist/server/entry.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用并检查服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now justinspace
sudo systemctl status justinspace
curl -fsS http://127.0.0.1:4321/api/health
```

Nginx 仍代理到 `127.0.0.1:4321`。Node 安装方式见 [Node.js 官方下载页](https://nodejs.org/en/download)。更新时检出明确的 commit，再安装依赖、构建并重启服务：

```bash
cd /srv/justinspace-src
sudo -u justinspace git fetch origin
sudo -u justinspace git checkout <commit>
sudo -u justinspace npm ci
sudo -u justinspace npx playwright install chromium
sudo -u justinspace npm run build:release
sudo systemctl restart justinspace
sudo systemctl status justinspace
```

部署前记录当前 commit；出现故障时切回该 commit，重新构建后重启服务。

## 官方安装资料

- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Tailscale on Linux](https://tailscale.com/docs/install/linux)
- [Tailscale SSH](https://tailscale.com/docs/features/tailscale-ssh)
- [Certbot with Nginx](https://certbot.eff.org/instructions?os=snap&ws=nginx)
- [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
