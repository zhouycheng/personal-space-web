import { test } from "playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

for (const script of [
  "journal.browser.mjs",
  "journal-recovery.browser.mjs",
  "journal-opening.browser.mjs",
  "journal-transport.browser.mjs",
]) {
  test(`existing journal regression: ${script}`, async ({ isMobile }) => {
    test.skip(isMobile, "The script itself covers desktop and narrow browser contexts");
    test.setTimeout(240_000);
    await run(process.execPath, [`tests/${script}`], {
      cwd: process.cwd(),
      timeout: 230_000,
      env: { ...process.env, JOURNAL_TEST_URL: "http://127.0.0.1:4323" },
    });
  });
}
