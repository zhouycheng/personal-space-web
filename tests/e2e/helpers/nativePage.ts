import { test as base, chromium, type Page } from "playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Lifecycle checks need real visibility; Playwright's normal focus emulation keeps tabs visible. */
export const test = base.extend<{ nativePage: Page; freshEntrance: boolean }>({
  freshEntrance: [false, { option: true }],
  nativePage: async ({ baseURL, freshEntrance }, use) => {
    const directory = await mkdtemp(path.join(tmpdir(), "justin-native-browser-"));
    const process = spawn(chromium.executablePath(), ["--remote-debugging-port=0", `--user-data-dir=${directory}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
    let browser;
    try {
      const deadline = Date.now() + 15_000;
      let port = "";
      while (!port && Date.now() < deadline) {
        port = await readFile(path.join(directory, "DevToolsActivePort"), "utf8").then(value => value.split("\n")[0]).catch(() => "");
        if (!port) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!port) throw new Error("Native Chromium did not expose its test debugging port");
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
      const context = browser.contexts()[0];
      const page = context.pages()[0];
      if(!freshEntrance)await page.addInitScript(() => sessionStorage.setItem('justin-entrance-completed','1'));
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(baseURL!);
      await use(page);
    } finally {
      await browser?.close(); process.kill();
      await new Promise<void>(resolve => process.exitCode !== null ? resolve() : process.once("exit", () => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  },
});
