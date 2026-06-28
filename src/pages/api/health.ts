import { getMacOsDesktopEntries } from "../../justin-kit/components/macos-desktop/runtime/desktop-scanner";
import { getCanvasStore } from "../../server/canvas/canvas-store";
import { createHealthReport } from "../../server/health";

export const prerender = false;

export async function GET() {
  const report = await createHealthReport({
    readDesktopEntries: () => getMacOsDesktopEntries({ strict: true }),
    checkDatabase: () => getCanvasStore().check(),
  });

  return new Response(JSON.stringify(report), {
    status: report.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
