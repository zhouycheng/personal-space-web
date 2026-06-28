import { getCanvasAssetStore } from "../../../../server/canvas/canvas-assets.ts";

export const prerender = false;

export async function GET({ params }: { params: { id?: string } }) {
  try {
    const asset = await getCanvasAssetStore().read(params.id || "");
    return new Response(asset.bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
