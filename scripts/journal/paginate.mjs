import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { sha256 } from "./fingerprint.mjs";
import { pageSize } from "./paths.mjs";

const require = createRequire(import.meta.url);

export async function paginateJournal({ articles, renderHash, paths, directory, signal }) {
  const { chromium } = await import("playwright");
  const css = await readFile(paths.cssPath, "utf8");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>'); return; }
      if (url.pathname === "/page.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
      const asset = url.pathname.startsWith("/journal/assets/");
      const font = url.pathname.startsWith("/journal/fonts/");
      if (!asset && !font) throw new Error("Unsupported generator request");
      const base = asset ? paths.assetsDir : paths.fontsDir;
      const file = path.resolve(base, decodeURIComponent(url.pathname.slice((asset ? "/journal/assets/" : "/journal/fonts/").length)));
      if (!file.startsWith(base + path.sep)) throw new Error("Invalid asset path");
      const data = await readFile(file);
      const extension = path.extname(file);
      res.setHeader("Content-Type", ({ ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[extension] ?? "application/octet-stream");
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const pages = [], files = {}, diagnostics = [];
  const abort = () => { void browser?.close().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    signal?.throwIfAborted();
    browser = await chromium.launch({ headless: true });
    for (const article of articles) {
      signal?.throwIfAborted();
      const page = await browser.newPage({ viewport: { width: 460, height: 700 }, deviceScaleFactor: pageSize.scale });
      page.setDefaultTimeout(60_000);
      await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin);
      await page.evaluate(() => { window.PagedConfig = { auto: false }; });
      await page.addScriptTag({ path: path.resolve(path.dirname(require.resolve("pagedjs")), "../dist/paged.polyfill.js") });
      const result = await page.evaluate(async ({ article, origin }) => {
        const source = document.createElement("article");
        source.innerHTML = article.html;
        const occurrences = new Map();
        for (const element of source.querySelectorAll("p,h1,h2,h3,h4,li,pre,figure,table,blockquote")) {
          let hash = 2166136261;
          for (const char of element.textContent) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
          const base = `${article.slug}-block-${hash.toString(16)}`;
          const occurrence = occurrences.get(base) ?? 0;
          occurrences.set(base, occurrence + 1);
          element.dataset.anchor = element.id || `${base}-${occurrence}`;
          if (!element.id) element.id = element.dataset.anchor;
        }
        for (const image of source.querySelectorAll("img")) {
          if (!image.getAttribute("src")?.startsWith("/journal/assets/")) throw new Error("Journal images must be local /journal/assets/ files");
        }
        const html = source.innerHTML;
        const heading = document.createElement("h1"); heading.textContent = article.title;
        const date = document.createElement("p"); date.className = "date"; date.textContent = article.date;
        source.prepend(heading, date);
        const font = new FontFace("Journal", `url(${origin}/journal/fonts/NotoSerifSC.woff2)`, { weight: "100 900" });
        document.fonts.add(await font.load()); await document.fonts.ready;
        for (const image of source.querySelectorAll("img")) { const loader = new Image(); loader.src = image.src; await loader.decode(); }
        const expected = source.textContent.replace(/\s/g, "");
        const target = document.createElement("div"); document.body.append(target);
        class PageLimit extends window.Paged.Handler {
          count = 0;
          afterPageLayout() { if (++this.count > 2000) throw new Error("Journal exceeds the pagination safety limit"); }
        }
        window.Paged.registerHandlers(PageLimit);
        await new window.Paged.Previewer().preview(source.innerHTML, [`${origin}/page.css`], target);
        await document.fonts.ready;
        const rendered = [...document.querySelectorAll(".pagedjs_page")];
        if (!rendered.length || rendered.length > 2000) throw new Error("Invalid pagination page count");
        const actual = rendered.map(element => element.querySelector(".pagedjs_page_content").textContent).join("").replace(/\s/g, "");
        const withoutHeaders = value => {
          for (const header of source.querySelectorAll("thead")) value = value.split(header.textContent.replace(/\s/g, "")).join("");
          return value;
        };
        if (withoutHeaders(actual) !== withoutHeaders(expected)) throw new Error("Pagination lost or duplicated text");
        const info = rendered.map(element => {
          const content = element.querySelector(".pagedjs_page_content");
          const rect = element.getBoundingClientRect();
          if (Math.abs(rect.width - 420) > 1 || Math.abs(rect.height - 594) > 1) throw new Error("Unexpected page dimensions");
          const bounds = content.getBoundingClientRect();
          const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(walker.currentNode);
            for (const line of range.getClientRects()) {
              if (line.bottom > bounds.bottom + 3 || line.top < bounds.top - 3 || line.right > bounds.right + 3 || line.left < bounds.left - 3) throw new Error(`Text overflows a page: ${walker.currentNode.textContent.slice(0, 30)}`);
            }
          }
          const regions = [];
          for (const node of content.querySelectorAll("a[href],img[src]")) {
            for (const rectangle of node.getClientRects()) {
              const x = Math.max(0, rectangle.left - rect.left), y = Math.max(0, rectangle.top - rect.top);
              if (!rectangle.width || !rectangle.height) continue;
              regions.push({ kind: node.tagName === "IMG" ? "image" : "link", href: node.getAttribute(node.tagName === "IMG" ? "src" : "href"), label: node.getAttribute("alt") || node.textContent || "图片", x, y, width: Math.min(rectangle.width, 420 - x), height: Math.min(rectangle.height, 594 - y) });
            }
          }
          return { anchors: [...new Set([...content.querySelectorAll("[data-anchor]")].map(node => node.dataset.anchor))], text: content.textContent, regions };
        });
        return { html, info };
      }, { article, origin });
      article.start = pages.length; article.count = result.info.length;
      diagnostics.push({ slug: article.slug, html: result.html, pages: result.info.map(info => info.text) });
      for (let i = 0; i < result.info.length; i++) {
        signal?.throwIfAborted();
        const index = pages.length, element = page.locator(".pagedjs_page").nth(i);
        await element.locator(".pagedjs_margin-bottom-center .pagedjs_margin-content").evaluate((node, number) => { node.textContent = String(number); node.style.setProperty("--pagedjs-string-first", "none"); node.classList.add("journal-page-number"); }, index + 1);
        await page.addStyleTag({ content: ".journal-page-number::after,.journal-page-number::before{content:none!important}" });
        const png = await element.screenshot({ type: "png" });
        for (const [folder, width, height] of [["pages", pageSize.width * pageSize.scale, pageSize.height * pageSize.scale], ["thumbnails", pageSize.width, pageSize.height]]) {
          const file = `${folder}/${index}.webp`;
          const pipeline = sharp(png).resize(width, height).webp(folder === "pages" ? { lossless: true } : { quality: 90 });
          await pipeline.toFile(path.join(directory, file));
          const bytes = await readFile(path.join(directory, file));
          files[file] = { sha256: sha256(bytes), bytes: bytes.length, width, height };
        }
        const { text: _text, ...pageInfo } = result.info[i];
        pages.push({ index, slug: article.slug, image: `/journal/generated/${renderHash}/pages/${index}.webp`, thumbnail: `/journal/generated/${renderHash}/thumbnails/${index}.webp`, imageWidth: pageSize.width * pageSize.scale, imageHeight: pageSize.height * pageSize.scale, ...pageInfo });
      }
      await page.close();
    }
    return { pages, files, diagnostics };
  } finally {
    signal?.removeEventListener("abort", abort);
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
