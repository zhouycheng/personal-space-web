import { getMacOsDesktopEntries } from "../../justin-kit/components/macos-desktop/runtime/desktop-scanner";
import { mineCanvasSeed } from "../../content/canvas/published";
import { createHealthReport } from "../../server/health";

export const prerender = false;

export async function GET() {
  const report = await createHealthReport({
    readDesktopEntries: () => getMacOsDesktopEntries({ strict: true }),
    checkCanvas: () => ({ ok: mineCanvasSeed.nodes.length > 0 && mineCanvasSeed.edges.every(edge => mineCanvasSeed.nodes.some(n => n.id === edge.source) && mineCanvasSeed.nodes.some(n => n.id === edge.target)) }),
  });

  return new Response(JSON.stringify(report), {
    status: report.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
