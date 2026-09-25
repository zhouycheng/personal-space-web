import { getMacOsDesktopEntries } from "../../justin-kit/components/macos-desktop/runtime/desktop-scanner";
import { getPublishedCanvas } from "../../data/repositories/canvas";
import { canvasContentIsValid } from "../../data/selectors/canvas";
import { createHealthReport } from "../../infrastructure/server/health";

export const prerender = false;

export async function GET() {
  const report = await createHealthReport({
    readDesktopEntries: () => getMacOsDesktopEntries({ strict: true }),
    checkCanvas: () => ({ ok: canvasContentIsValid(getPublishedCanvas()) }),
  });

  return new Response(JSON.stringify(report), {
    status: report.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
