import { isCanvasSessionAuthorized } from "../../../server/canvas/canvas-auth.ts";
import { getCanvasAssetStore } from "../../../server/canvas/canvas-assets.ts";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST({ request }: { request: Request }) {
  if (!isCanvasSessionAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
    const asset = await getCanvasAssetStore().write(new Uint8Array(await file.arrayBuffer()), file.type);
    return json({
      id: asset.id,
      url: asset.url,
      mimeType: asset.mimeType,
      size: asset.size,
      checksum: asset.checksum,
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Asset upload failed" }, 400);
  }
}
