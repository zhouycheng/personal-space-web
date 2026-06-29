import { canvasAdminHeaders } from "./canvas-admin-session";

export type UploadedCanvasAsset = {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  checksum: string;
};

export async function uploadCanvasAsset(file: Blob, fileName = "canvas-image"): Promise<UploadedCanvasAsset> {
  const form = new FormData();
  form.append("file", file, fileName);
  const response = await fetch("/api/canvas/assets", {
    method: "POST",
    credentials: "same-origin",
    headers: canvasAdminHeaders(),
    body: form,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Asset upload failed");
  return body as UploadedCanvasAsset;
}
