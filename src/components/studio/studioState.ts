export type StudioState = "room" | "entering" | "desktop" | "returning";
export type StudioAction = "computer" | "works" | "about" | "library" | "contact" | "chair";
export const STUDIO_STATE_KEY = "justin-alpha-studio-v1";
export const ACTION_LABELS: Record<StudioAction, string> = {
  computer: "进入 Justin OS", works: "作品集", about: "个人介绍",
  library: "人生系统", contact: "公开链接", chair: "转动座椅",
};
export function restoredStudioState(value: string | null): StudioState {
  return value === "desktop" ? "desktop" : "room";
}
export function stableStudioState(state: StudioState): "room" | "desktop" {
  return state === "desktop" || state === "returning" ? "desktop" : "room";
}
export function nextStudioState(state: StudioState, action: "enter" | "return" | "complete" | "cancel"): StudioState {
  if (action === "cancel") return stableStudioState(state);
  if (action === "enter" && state === "room") return "entering";
  if (action === "return" && state === "desktop") return "returning";
  if (action === "complete" && state === "entering") return "desktop";
  if (action === "complete" && state === "returning") return "room";
  return state;
}
