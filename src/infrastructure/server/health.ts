import type { JournalPackageHealth } from "./journalPackageHealth";

type HealthDependencies = {
  readDesktopEntries: () => Promise<Array<unknown>>;
  checkCanvas: () => { ok: boolean };
  checkJournal: () => Promise<JournalPackageHealth>;
  production: boolean;
};

export type HealthReport = {
  ok: boolean;
  desktopEntries: number;
  canvas: boolean;
  journal?: JournalPackageHealth;
  degraded?: boolean;
  checkedAt: string;
  error?: string;
};

export async function createHealthReport(dependencies: HealthDependencies): Promise<HealthReport> {
  try {
    const entries = await dependencies.readDesktopEntries();
    const canvas = dependencies.checkCanvas();
    const journal = await dependencies.checkJournal();
    return {
      ok: entries.length > 0 && canvas.ok && (!dependencies.production || journal.ok),
      desktopEntries: entries.length,
      canvas: canvas.ok,
      journal,
      degraded: !journal.ok,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      desktopEntries: 0,
      canvas: false,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown health check failure",
    };
  }
}
