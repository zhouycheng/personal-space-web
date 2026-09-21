# 实体日记本

日记由 Markdown 源文、构建时分页产物和工作室内的 Three.js 书本组成。默认使用立体阅读；文字阅读提供可选择、复制的正文，也作为 WebGL 失败时的入口。

## 内容与写作

文章放在 `src/content/journal/*.md`，文件名就是稳定 slug。Frontmatter 使用 `title`、`pubDate`（YYYY-MM-DD）、可选 `description` 和 `draft`。只有 `draft: true` 会排除文章。图片放在 `public/journal/assets/`，正文使用 `/journal/assets/文件名`；不要引用远程图片或执行脚本。

迁入源为 `zhouycheng/zhouycheng.github.io` 的 `src/content/blog/20260527-记录和节奏.md`，保留原文件名、frontmatter 和正文。原站继续存在。本项目的 `/blog/[slug]` 返回 301 到 `/journal/[slug]`；这不会修改旧域名的响应。RSS 在 `/rss.xml`。

新增文章后，开发服务器自动重新分页并刷新。正式构建自动生成全部已发布文章；缺失图片、字体、分页丢字或内容溢出会让构建失败。

## 分页链路

使用固定 Node 22.22.3、锁文件中的 Paged.js / Playwright 和本地 WOFF2 格式 Noto Serif SC 字体。首次安装依赖后运行 `npm run journal:setup` 下载 Chromium。Linux 构建环境使用 `npx playwright install --with-deps chromium`。Docker 仅在 Debian 构建阶段安装浏览器，运行阶段仍使用 Node Alpine。

`npm run journal:build` 将 Markdown 解析并清洗成受控 HTML，经 Paged.js 排成 420×594 CSS px 的书页。字体与图片解码完成后，由 Chromium 以 2× 像素截图，输出普通和高清 WebP。正文 20px，1.7 倍行高；段落可跨页，标题避免孤立，图片适配纸面，代码按行续页，表格按行分割。

输出位于被 Git 排除的 `public/journal/generated/` 与 `src/generated/journal.json`。清单包含文章、书页、稳定段落锚点、链接和图片区域。正文、资源、字体、排版脚本及锁文件共同参与内容哈希。失败时保留上一份完整清单，命令仍以错误退出；不得把旧清单当作成功的新构建。

字体位于 `public/journal/fonts/`，随附 OFL 许可证。文字阅读模式使用系统字体，不需要下载整份排版字体。

## 交互与状态

`/journal` 默认恢复有效的本机书签，否则打开最新文章；独立文章 URL 优先于其他文章的书签。实体书按文章日期正序编排，每篇另起一页，目录倒序显示。

桌面双页翻动右侧纸张：正面为当前右页，背面为下一展开的左页。手机单页逐面阅读，旋转屏幕保持当前内容。翻页只保存本地阅读锚点，不增加浏览器历史；目录切换文章会增加历史。

页角拖动支持回弹，翻动期间不累计输入。放大入口展示当前高清书页，可平移查看；文字阅读支持复制。页内链接和图片通过清单坐标映射响应，正文区域不会触发翻页。

书本复用工作室的 WebGLRenderer、相机和按需渲染循环。只缓存当前与附近两组展开面的纹理；合上书本释放纹理，离开页面销毁事件与几何资源，页面隐藏停止渲染。减少动态效果时直接切换稳定状态。

## 验证入口

```bash
node --test tests/*.test.mjs
node tests/journal.browser.mjs
node tests/journal-recovery.browser.mjs
npm run build
npx tsc --noEmit
```

浏览器测试默认连接 `http://127.0.0.1:4321`；用 `JOURNAL_TEST_URL` 指向隔离的测试服务，`PLAYWRIGHT_CHANNEL=chrome` 可选择已安装的 Chrome。分页测试使用临时内容、资源及输出目录，覆盖 8 页中文混排、缓存及缺失图片失败后的旧清单保护。测试数据库应通过既有环境变量指定临时路径。

### 2026-09-21 验收记录

- Node 22.22.3 下 54 项 Node 测试及 Astro 生产构建通过。
- Chrome 与 Playwright Chromium 检查了 1440×1000 双页、390×844 单页、翻页中间帧及背面、拖动完成/取消/反向、目录和独立链接、阅读放大与文字模式、书签、刷新和浏览器历史。
- 检查了重复开合后纹理数归零、进入中返回、全部共享页面的直达和刷新、减少动态效果、WebGL 创建失败、纹理加载失败与重试。独立 Node 生产服务下 RSS、301 跳转、书页资源和健康接口通过。
- 类型检查仍有符号半球组件的 19 项既有 strict-null 错误，日记相关代码无新增类型错误。
- Docker 守护进程未运行，未执行镜像构建或容器运行验收；Safari、手机真机触控和性能未验证。
