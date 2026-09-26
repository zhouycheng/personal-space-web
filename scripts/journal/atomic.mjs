import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeAtomic(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, data); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
}

async function claim(file, owner) {
  const temporary = `${file}.${owner.token}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(owner), { flag: "wx" });
    // Hard-link creation is exclusive and exposes only the complete owner record.
    await link(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

/** Exclusive creation plus an owner token prevents releasing another generator's lock. */
export async function acquireJournalLock(outputDir) {
  await mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, ".generation.lock");
  const owner = { pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await claim(file, owner);
      return async () => {
        const current = JSON.parse(await readFile(file, "utf8").catch(() => "null"));
        if (current?.token === owner.token) await rm(file, { force: true });
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const recovery = `${file}.recovering`;
      try { await claim(recovery, owner); }
      catch { throw new Error("Another generator is inspecting the stale lock"); }
      try {
        let prior;
        try { prior = JSON.parse(await readFile(file, "utf8")); }
        catch (readError) {
          if (readError.code === "ENOENT") continue;
          throw new Error("Journal generation lock is unreadable; inspect its owner before removing it");
        }
        if (alive(prior.pid)) throw new Error(`Journal generation already running (pid ${prior.pid})`);
        // A dead PID is required; age alone never permits stealing a live lock.
        await rename(file, `${file}.stale-${owner.token}`).then(() => rm(`${file}.stale-${owner.token}`, { force: true }));
      } finally { await rm(recovery, { force: true }); }
    }
  }
  throw new Error("Could not acquire journal generation lock");
}
