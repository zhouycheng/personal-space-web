export type StudioState = "room" | "entering" | "desktop" | "returning" | "entering-canvas" | "canvas" | "returning-canvas";
export type StudioAction = "computer" | "canvas" | "works" | "chair";
export const ACTION_LABELS: Record<StudioAction, string> = {
  computer: "进入 Justin OS", canvas: "我的画布",
  works: "作品集", chair: "转动座椅",
};
