import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir, rename, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import sharp from "sharp";
import { compileJournalContent } from "./journal-content.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(p)); else out.push(p);
  }
  return out.sort();
}

export async function buildJournal(options = {}) {
  const sourceDir = options.sourceDir ?? path.join(root, "src/content/journal");
  const outputDir = options.outputDir ?? path.join(root, "public/journal/generated");
  const manifestPath = options.manifestPath ?? path.join(root, "src/generated/journal.json");
  const assetsDir = options.assetsDir ?? path.join(root, "public/journal/assets");
  const compiled = await compileJournalContent({ sourceDir });
  const { sources, contentHash } = compiled;
  const inputs = [...sources, ...await files(path.join(root, "public/journal/fonts")), ...await files(assetsDir), path.join(root, "scripts/journal-page.css"), fileURLToPath(import.meta.url), path.join(root, "package-lock.json")];
  const digest = createHash("sha256");
  digest.update(options.channel ?? 'playwright-chromium');
  for (const input of inputs) digest.update(input.replace(root, "")).update(await readFile(input));
  const hash = digest.digest("hex").slice(0, 20);
  try {
    const cached = JSON.parse(await readFile(manifestPath, "utf8"));
    if (cached.hash === hash && !options.force) {
      for (const p of cached.pages) {
        await access(path.join(outputDir, path.basename(p.image)));
        await access(path.join(outputDir, path.basename(p.thumbnail)));
      }
      console.log(`Journal: ${cached.pages.length} cached pages`); return cached;
    }
  } catch { /* Missing or incomplete cache is rebuilt. */ }
  const articles = compiled.articles;
  await mkdir(outputDir, { recursive: true });
  const css = await readFile(path.join(root, "scripts/journal-page.css"), "utf8");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/") { res.setHeader("Content-Type", "text/html");res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>');return; }
      if (url.pathname === "/page.css") { res.setHeader("Content-Type", "text/css");res.end(css);return; }
      const assetRequest = url.pathname.startsWith('/journal/assets/');
      const base = assetRequest ? assetsDir : path.join(root, 'public');
      const p = path.resolve(base, assetRequest ? decodeURIComponent(url.pathname.slice('/journal/assets/'.length)) : '.' + decodeURIComponent(url.pathname));
      if (!p.startsWith(base + path.sep)) throw new Error("Invalid asset path");
      const data = await readFile(p);
      res.setHeader("Content-Type", p.endsWith(".woff2") ? "font/woff2" : p.endsWith(".ttf") ? "font/ttf" : p.endsWith(".svg") ? "image/svg+xml" : p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "application/octet-stream");res.end(data);
    } catch { res.writeHead(404);res.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const pages = [];
  try {
    browser = await chromium.launch({ headless: true, ...(options.channel ? {channel:options.channel} : {}) });
    for (const article of articles) {
      const page = await browser.newPage({ viewport: { width: 460, height: 700 }, deviceScaleFactor: 2 });
      page.setDefaultTimeout(60_000);
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin);
      await page.evaluate(() => { window.PagedConfig = { auto: false }; });
      await page.addScriptTag({ path: path.resolve(path.dirname(require.resolve("pagedjs")), "../dist/paged.polyfill.js") });
      const result = await page.evaluate(async ({ article, origin }) => {
        const source = document.createElement("article");
        source.innerHTML = article.html;
        for (const el of source.querySelectorAll("p,h1,h2,h3,h4,li,pre,figure,table,blockquote")) {
          let hash=2166136261;
          for(const char of el.textContent)hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;
          const base=`${article.slug}-block-${hash.toString(16)}`;
          const occurrence=[...source.querySelectorAll('[data-anchor]')].filter(node=>node.dataset.anchor.startsWith(base)).length;
          el.dataset.anchor = el.id || `${base}-${occurrence}`;
          if (!el.id) el.id = el.dataset.anchor;
        }
        for (const img of source.querySelectorAll("img")) {
          if (!img.getAttribute("src")?.startsWith("/journal/assets/")) throw new Error("Journal images must be local /journal/assets/ files");
        }
        article.html = source.innerHTML;
        const heading = document.createElement("h1");heading.textContent = article.title;
        const date = document.createElement("p");date.className = "date";date.textContent = article.date;
        source.prepend(heading, date);
        const font = new FontFace("Journal", `url(${origin}/journal/fonts/NotoSerifSC.woff2)`, { weight: "100 900" });
        document.fonts.add(await font.load());await document.fonts.ready;
        for (const img of source.querySelectorAll("img")) {
          const image = new Image();image.src = img.src;await image.decode();
        }
        const expected = source.textContent.replace(/\s/g, "");
        const target = document.createElement("div");document.body.append(target);
        class PageLimit extends window.Paged.Handler {
          count=0;
          afterPageLayout(){if(++this.count>2000)throw new Error('Journal exceeds the pagination safety limit');}
        }
        window.Paged.registerHandlers(PageLimit);
        await new window.Paged.Previewer().preview(source.innerHTML, [`${origin}/page.css`], target);
        await document.fonts.ready;
        const rendered = [...document.querySelectorAll(".pagedjs_page")];
        if (!rendered.length || rendered.length > 2000) throw new Error("Invalid pagination page count");
        const actual = rendered.map(el => el.querySelector(".pagedjs_page_content").textContent).join("").replace(/\s/g, "");
        // Repeated table headers are excluded from exact-text comparison below.
        const withoutHeaders = value => {
          for (const th of source.querySelectorAll('thead')) value = value.split(th.textContent.replace(/\s/g, '')).join('');
          return value;
        };
        if (withoutHeaders(actual) !== withoutHeaders(expected)) throw new Error("Pagination lost or duplicated text");
        const info = rendered.map(el => {
          const content = el.querySelector(".pagedjs_page_content");
          const rect = el.getBoundingClientRect();
          if (Math.abs(rect.width - 420) > 1 || Math.abs(rect.height - 594) > 1) throw new Error("Unexpected page dimensions");
          const bounds=content.getBoundingClientRect();
          const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);
          while(walker.nextNode()){
            if(!walker.currentNode.textContent.trim())continue;
            const range=document.createRange();range.selectNodeContents(walker.currentNode);
            for(const line of range.getClientRects()){
              if(line.bottom>bounds.bottom+3||line.top<bounds.top-3||line.right>bounds.right+3||line.left<bounds.left-3)throw new Error(`Text overflows a page: ${walker.currentNode.textContent.slice(0,30)}`);
            }
          }
          const regions = [];
          for (const node of content.querySelectorAll("a[href],img[src]")) {
            for (const r of node.getClientRects()) {
              const x = Math.max(0, r.left - rect.left), y = Math.max(0, r.top - rect.top);
              if (!r.width || !r.height) continue;
              regions.push({ kind: node.tagName === "IMG" ? "image" : "link", href: node.getAttribute(node.tagName === "IMG" ? "src" : "href"), label: node.getAttribute("alt") || node.textContent || "图片", x, y, width: Math.min(r.width, 420 - x), height: Math.min(r.height, 594 - y) });
            }
          }
          return { anchors: [...new Set([...content.querySelectorAll("[data-anchor]")].map(n => n.dataset.anchor))], text: content.textContent, regions };
        });
        return { html: article.html, info };
      }, { article, origin });
      article.html = result.html;article.start = pages.length;article.count = result.info.length;
      for (let i = 0; i < result.info.length; i++) {
        const index = pages.length;
        const basename = `${hash}-${index}`;
        const element = page.locator(".pagedjs_page").nth(i);
        await element.locator(".pagedjs_margin-bottom-center .pagedjs_margin-content").evaluate((el, number) => { el.textContent = String(number);el.style.setProperty("--pagedjs-string-first", "none");el.classList.add("journal-page-number"); }, index + 1);
        await page.addStyleTag({ content: '.journal-page-number::after,.journal-page-number::before{content:none!important}' });
        const png = await element.screenshot({ type: "png" });
        await sharp(png).webp({ lossless: true }).toFile(path.join(outputDir, `${basename}@2x.webp`));
        await sharp(png).resize(420, 594).webp({ quality: 90 }).toFile(path.join(outputDir, `${basename}.webp`));
        pages.push({ index, slug: article.slug, image: `/journal/generated/${basename}@2x.webp`, thumbnail: `/journal/generated/${basename}.webp`, ...result.info[i] });
      }
      await page.close();
    }
    const manifest = { version: 1, hash, contentHash, width: 420, height: 594, articles, pages };
    await mkdir(path.dirname(manifestPath), { recursive: true });
    const json = JSON.stringify(manifest);
    const tempManifest = `${manifestPath}.${process.pid}.tmp`;
    await writeFile(tempManifest, json);await rename(tempManifest, manifestPath);
    // The manifest is the commit point: old image sets stay available until a successful build.
    const publicManifest = path.join(outputDir, "manifest.json");
    const tempPublic = `${publicManifest}.${process.pid}.tmp`;
    await writeFile(tempPublic, json);await rename(tempPublic, publicManifest);
    console.log(`Journal: ${articles.length} articles, ${pages.length} pages`);
    return manifest;
  } finally { await browser?.close();await new Promise(resolve => server.close(resolve)); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildJournal();
