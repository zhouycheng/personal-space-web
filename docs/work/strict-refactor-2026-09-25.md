# 严格目录重构验收记录（2026-09-25）

本轮把本站生产代码迁入 `docs/develop/architecture.md` 所列责任层。`src/components/`、`src/features/`、`src/server/`、`src/lib/`、`src/layouts/`、`src/styles/`、`src/assets/`、`src/playground/` 已从工作树移除；Astro 约定文件、忽略的生成清单以及 `public/os-desktop/` 按方案保留。`npm run check:boundaries` 检查 133 个源码文件及依赖方向。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| `npm run test:unit` | 50 通过，0 失败 |
| `npm run check:types` | Astro 0 错误、0 警告、0 提示；`tsc --noEmit` 通过 |
| `npm run build` | 通过；另在未复制书页清单、浏览器缓存路径为空的临时项目中得到 `Journal: 1 articles, text mode`，构建后的 `/journal`、独立文章 URL 和 `/api/health` 均返回 200，正文出现在 HTML 中 |
| `npm run build:release` | 通过；1 篇文章、2 页，书页完整性校验通过 |
| `npm run test:e2e` | Playwright Chromium 23 通过、7 跳过、0 失败。跳过项是同一桌面脚本在 mobile project 中的重复运行和桌面专用指针流程；脚本自身含窄屏、模拟触控和减少动态效果检查 |
| `docker compose config --quiet` | 通过；本机 Docker 守护进程未运行，镜像构建和容器运行未验证 |

浏览器回归覆盖直达、刷新、前进后退、动画中返回、窗口打开和关闭、画布位置持久化及恢复默认布局、WebGL 失败后的键盘入口与日记正文、RSS 和健康接口。旧日记脚本仍检查开合中间帧、双页、指针取消、模拟触控、减少动态效果和资源回收。

在固定视口、相机与本地时间下对比重构前后截图：`/works`、`/canvas`、`/journal`、窄屏画布无像素差异；`/home` 的差异像素约 0.01%。OS 顶部 350px 的静态菜单、提示与图标区域无像素差异；下方动态符号半球处于不同动画帧，未把逐像素差异视为静态视觉回归。截图留在被忽略的 `.workspace/refactor-baseline/` 和 `.workspace/refactor-current/`。

## 审查工具与限制

OpenCodeReview CLI 可运行。CLIProxyAPI 7.3.15 曾以 `127.0.0.1:8317` 启动，本机 `/v1/models` 返回 200，但没有导入 Codex 授权；`ocr llm test` 未成功，未运行 AI 审查。已执行分阶段 diff、导入边界、类型、构建和行为回归审查。CLIProxyAPI 已停止。

Docker 守护进程、Safari 和手机真机触控尚未验收。Vite 构建提示一个超过 500 kB 的客户端 chunk；这是当前体积提示，未观察到构建或交互失败。
