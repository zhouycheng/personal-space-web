import {
  CANVAS_ADMIN_TAB_HEADER,
  CANVAS_ADMIN_TAB_STORAGE_KEY,
  isCanvasAdminTabToken,
} from "../domain/canvas-admin-session";

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function createCanvasAdminTabToken() {
  return randomBase64Url(32);
}

export function getCanvasAdminTabToken() {
  try {
    const value = sessionStorage.getItem(CANVAS_ADMIN_TAB_STORAGE_KEY);
    return isCanvasAdminTabToken(value) ? value : "";
  } catch {
    return "";
  }
}

export function setCanvasAdminTabToken(value: string) {
  if (!isCanvasAdminTabToken(value)) return;
  sessionStorage.setItem(CANVAS_ADMIN_TAB_STORAGE_KEY, value);
}

export function clearCanvasAdminTabToken() {
  try {
    sessionStorage.removeItem(CANVAS_ADMIN_TAB_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the server cookie is still cleared by dispose.
  }
}

export function canvasAdminHeaders(): Record<string, string> {
  const token = getCanvasAdminTabToken();
  return token ? { [CANVAS_ADMIN_TAB_HEADER]: token } : {};
}
