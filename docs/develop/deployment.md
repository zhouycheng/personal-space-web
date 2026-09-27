# 自动部署

当前生产流水线是 GitHub Actions → GHCR → Tailscale SSH → Docker Compose。PR 运行检查；只有检查通过的 `main` 提交才发布镜像并部署。

服务器只有一个专用 `deploy` 账号和一个 root 管理的 `/usr/local/sbin/deployctl` 入口。它不属于 `sudo` 或 `docker` 组，也没有任意 Docker 权限。CI 只能选择已登记的部署目标，并提交该目标允许的 OCI 仓库中的不可变 sha256 镜像摘要；部署脚本不会执行 CI 提供的命令、Compose 路径或任意镜像。

## GitHub 配置

在仓库创建 `production` environment，并将允许部署的分支限制为 `main`。自动部署不配置人工 reviewer。

在该 environment 的 **Environment secrets** 中由管理员录入以下值。不要把实际值提交到 Git 仓库、写入 workflow、粘贴到聊天或作为普通 Actions variable 保存：

- `TAILSCALE_SERVER`：已验证的服务器 Tailscale IP 或 MagicDNS 名称。
- `PRODUCTION_URL`：规范的 HTTPS 站点地址。
- `TS_OAUTH_CLIENT_ID`
- `TS_AUDIENCE`

路径：GitHub 仓库 → **Settings → Environments → production → Environment secrets**。Client ID 和 Audience 从 Tailscale GitHub OIDC 联邦身份设置中复制；服务器地址从 `tailscale status` / MagicDNS 管理页复制；站点地址填写最终对外提供 HTTPS 的 URL。先在 GitHub 页面直接保存这些 secret，不需要把值提供给 CI workflow 编辑者。

Tailscale 中创建 GitHub OIDC 联邦身份，issuer 使用 `https://token.actions.githubusercontent.com`，权限只选 `auth_keys`，设备 tag 只选 `tag:ci`。使用 GitHub 当前显示的不可变 environment subject，并通过 custom claim rules 精确限制仓库、`production` environment 和 `refs/heads/main`。将生成的 Client ID 和 Audience 保存到 GitHub environment secrets `TS_OAUTH_CLIENT_ID` 和 `TS_AUDIENCE`；不要把具体身份 subject、Client ID 或 Audience 写入本仓库。

发布镜像使用 `GITHUB_TOKEN` 和 `packages: write`。将 `personal-space-web` Container package 设为 Private，并确认 `personal-space-web` 仓库具有该 package 的 GitHub Actions 访问权限。部署 job 使用单独的 `GITHUB_TOKEN`、`packages: read`，经 Tailscale SSH 标准输入把镜像摘要、GitHub actor 和短期 token 传给 root 管理的入口；服务器在 `/run` 建立仅 root 可读的临时 Docker 配置，拉取摘要后随命令退出清除。token 不作为命令行参数、不会保存到服务器，也不会写入日志或镜像。发布 job 在保持 GHCR 登录时拉取新摘要以验证私有包权限。不要创建长期 PAT 来替代 job token。

GitHub 官方提示：如果公开仓库获准访问私有 package，该仓库的 fork workflow 可能也能读取该 package。JustinSpace 源仓库当前为 Public，因此私有可见性阻止匿名 registry 拉取，但不应将它视为对公开源码 fork 的保密边界。镜像不得包含运行时秘密；`.dockerignore` 排除 `.env*`、数据、备份和临时目录。

## Tailnet 策略

服务器使用 `tag:prod`，CI 临时节点使用 `tag:ci`。在当前 Tailnet 策略中保留既有成员规则，并确保以下网络与 SSH 权限同时存在；不要用此片段替换整个策略：

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

Tailscale SSH 连接必须同时通过 network grant 和 SSH policy。`accept` 适用于自动化，无需交互式重新认证。GitHub Actions 使用 OIDC 创建临时节点，workflow 结束后清理；其他 CI 必须单独配置自己的 OIDC 联邦身份或受限的临时认证方式，不能复用 GitHub 的信任条件。客户端使用 `tailscale ssh` 校验由 Tailscale 控制面分发的主机密钥；不要关闭主机密钥校验。

## 服务器配置

新系统需安装 Docker Engine、Compose plugin、Nginx 和 Tailscale。应用由宿主机 Nginx 代理时，只将 Compose 的应用端口绑定到 `127.0.0.1`；重新确认域名解析和 TLS 证书后再启用公网 HTTPS。系统重装会删除旧服务器运行数据、配置和证书。

创建专用账号（若尚不存在），锁定本机密码，并确认它没有额外组权限：

```bash
sudo useradd --create-home --user-group --shell /bin/bash deploy
sudo passwd --lock deploy
sudo chmod 0700 /home/deploy
id deploy
```

安装入口和 sudoers 规则：

```bash
sudo install -d -o root -g root -m 0755 /usr/local/sbin /etc/deployctl/targets
sudo install -o root -g root -m 0755 scripts/deploy/deployctl.sh /usr/local/sbin/deployctl
sudo install -o root -g root -m 0440 scripts/deploy/deployctl.sudoers /etc/sudoers.d/deployctl
sudo visudo -cf /etc/sudoers.d/deployctl
```

为 JustinSpace 登记唯一允许的镜像仓库、registry、Compose 目录、项目、服务和镜像环境变量：

```bash
sudo install -o root -g root -m 0600 scripts/deploy/targets/justinspace.conf.example /etc/deployctl/targets/justinspace.conf
sudoedit /etc/deployctl/targets/justinspace.conf
```

配置文件中的 Compose 路径必须指向 root 管理的文件和目录。运行环境 `.env*` 留在服务器上，权限按其中密钥设置。目标 Compose 文件须以 `image: ${JUSTINSPACE_IMAGE:-justinspace:local}` 提供生产镜像变量，且服务名须为 `justinspace`。当前仓库 Compose 把端口 `4321` 绑定到 `127.0.0.1`，不直接暴露应用端口到公网。

启用服务器 Tailscale SSH 并将其标记为生产节点：

```bash
sudo tailscale set --advertise-tags=tag:prod --ssh
```

从已授权客户端检查访问与 sudo 边界：

```bash
tailscale ssh deploy@服务器地址 true
tailscale ssh deploy@服务器地址 'sudo -n -l'
```

sudo 列表只应包含 `/usr/local/sbin/deployctl`。部署账号只可使用该 root 管理入口；入口只接受 `deploy|rollback` 和安全格式的目标名称。

## 增加其他项目或 CI 来源

部署来源是 OCI 镜像仓库，不限定代码托管或 CI 平台。GitHub、Gitee 或其他 CI 需要：构建并推送 OCI 镜像、取得不可变 `repository@sha256:...` 摘要、通过 Tailscale SSH 调用入口。仓库、registry、Compose 目录、Compose 服务和镜像变量由服务器 root 在 `/etc/deployctl/targets/<目标>.conf` 单独登记；CI 不能自行扩展 allowlist。私有 registry 凭据只在部署时通过标准输入传给 root 管理的入口，保存在 `/run` 的临时 Docker 配置中并在命令结束时清除；不能传给 `deploy` 用户的命令参数或写入镜像。

通用调用形态：

```bash
printf '%s\n%s\n%s\n' "$IMAGE_DIGEST" "$REGISTRY_USERNAME" "$REGISTRY_TOKEN" | tailscale ssh "deploy@$TAILSCALE_SERVER" \
  'sudo -n /usr/local/sbin/deployctl deploy <target>'
```

回滚调用将用户名和 token 两行通过标准输入发送，并固定执行 `sudo -n /usr/local/sbin/deployctl rollback <target>`。部署端不接受 CI 传入的 shell 命令、Compose 路径、registry host 或任意镜像仓库。

不同 CI 使用各自的 OIDC 或短期 Tailscale 认证，并将节点限制为 `tag:ci`；若某平台不能可靠地提供短期身份，就先为它单独评估认证方式，不要把长期私钥放进仓库。

## 部署与回滚

服务器先验证目标 allowlist 与镜像摘要，再只拉取和重建登记的 Compose 服务，等待 Docker healthcheck 通过后保存当前和上一镜像。失败时自动恢复上一镜像；首次部署没有上一镜像，健康检查失败会移除新建的服务容器并保留镜像与卷。GitHub workflow 随后检查 `/api/health` 的 `ok`、桌面数量、画布和日记状态，以及 `/`、`/home`、`/works`、`/canvas`、`/os` 的 HTTPS 响应；公开检查失败时再次调用入口回滚。

不执行 Docker prune，不触碰其他服务或运行数据。初次上线前确认运行数据、`.env*`、挂载和 TLS 证书已按新系统的实际情况配置。
