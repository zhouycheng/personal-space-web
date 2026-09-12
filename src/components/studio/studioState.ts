export type StudioState = "room" | "entering" | "desktop" | "returning" | "entering-canvas" | "canvas" | "returning-canvas";
export type StudioAction = "computer" | "canvas" | "about" | "works" | "contact" | "chair";
export const ACTION_LABELS: Record<StudioAction, string> = {
  computer: "进入 Justin OS", canvas: "我的画布", about: "个人介绍",
  works: "作品集", contact: "公开链接", chair: "转动座椅",
};
