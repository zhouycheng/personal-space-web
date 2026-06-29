export const CANVAS_ADMIN_TAB_HEADER = "X-Canvas-Admin-Tab";
export const CANVAS_ADMIN_TAB_STORAGE_KEY = "justin_canvas_admin_tab_token";

const ADMIN_TAB_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,160}$/;

export function isCanvasAdminTabToken(value: unknown): value is string {
  return typeof value === "string" && ADMIN_TAB_TOKEN_PATTERN.test(value);
}
