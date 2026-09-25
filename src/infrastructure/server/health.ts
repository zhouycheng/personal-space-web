type HealthDependencies = {
  readDesktopEntries: () => Promise<Array<unknown>>;
  checkCanvas: () => { ok: boolean };
};

export type HealthReport = {
  ok: boolean;
  desktopEntries: number;
  canvas: boolean;
  checkedAt: string;
  error?: string;
};

export async function createHealthReport(dependencies: HealthDependencies): Promise<HealthReport> {
  try {
    const entries = await dependencies.readDesktopEntries();
    const canvas = dependencies.checkCanvas();
    return {
      ok: entries.length > 0 && canvas.ok,
      desktopEntries: entries.length,
      canvas: canvas.ok,
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
