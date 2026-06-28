type HealthDependencies = {
  readDesktopEntries: () => Promise<Array<unknown>>;
  checkDatabase: () => { ok: boolean };
};

export type HealthReport = {
  ok: boolean;
  desktopEntries: number;
  database: boolean;
  checkedAt: string;
  error?: string;
};

export async function createHealthReport(dependencies: HealthDependencies): Promise<HealthReport> {
  try {
    const entries = await dependencies.readDesktopEntries();
    const database = dependencies.checkDatabase();
    return {
      ok: entries.length > 0 && database.ok,
      desktopEntries: entries.length,
      database: database.ok,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      desktopEntries: 0,
      database: false,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown health check failure",
    };
  }
}
