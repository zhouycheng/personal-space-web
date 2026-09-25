<p align="center"><strong>JustinWeb 是一个以交互式 3D 工作室为入口的个人空间网站</strong></p>

<p align="center">
  <img src="docs/images/justinweb-homepage.png" alt="JustinWeb 三维工作室首页" width="100%">
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22.12%2B-339933" alt="Node.js 22.12+"></a>
  <a href="https://astro.build/"><img src="https://img.shields.io/badge/Astro-7-BC52EE" alt="Astro 7"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-149ECA" alt="React 19"></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-0.186-black" alt="Three.js 0.186"></a>
  <br>
  <a href="#功能">页面导览</a> ·
  <a href="#本地运行">本地开发</a> ·
  <a href="docs/README.md">项目文档</a> ·
  <a href="CHANGELOG.md">变更记录</a> ·
  <a href="https://github.com/zhouycheng/personal-space-web/issues">问题反馈</a>
</p>

## 功能

- `/home`：可交互的 Three.js 工作室。
- `/works`：项目作品和简历。
- `/canvas`：可拖动浏览的 ReactFlow 画布。
- `/os`：文件驱动的桌面与窗口。
- `/journal`：带实体翻页效果的日记。

## Fork 与授权

网站自有代码使用 [Zlib](LICENSE)；真实简历、日记、头像、作品资料和其他个人内容保留权利，第三方材料沿用其原许可。Fork 后可修改网站代码并换成自己的资料，但须遵守 Zlib 对原始来源、修改版本和许可声明的要求。授权文件的适用范围见 [LICENSING.md](LICENSING.md)，个人内容见 [CONTENT-LICENSE.md](CONTENT-LICENSE.md)，第三方材料见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 本地运行

开发时使用 `.node-version` 指定的 Node.js 版本（当前为 `26.9.0`，运行要求 `>=22.12.0`）。

```bash
npm ci
npm run dev
```

普通开发和 `npm run build` 会直接从 Markdown 生成可阅读日记正文，不需要 Chromium。发布实体书前运行 `npm run journal:setup`，然后运行 `npm run build:release`。自动检查入口：`npm run check:boundaries`、`npm run check:types`、`npm run test:unit`、`npm run test:e2e`。

简历、作品和文件盒顺序分别维护在 `src/content/site/resume.json`、`projects.json` 和 `studio-files.json`；画布发布内容在 `src/content/canvas/published.ts`，日记正文在 `src/content/journal/`。目录职责与依赖规则见[架构说明](docs/develop/architecture.md)。

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
