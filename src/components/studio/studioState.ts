export type StudioState = "room" | "entering" | "desktop" | "returning" | "entering-canvas" | "canvas" | "returning-canvas";
export type StudioAction = "computer" | "canvas" | "works" | "chair" | "lamp" | "clock" | "drawer-top" | "drawer-middle" | "drawer-bottom" | "diary";
export const DIARY_URL = "https://zhouycheng.github.io";
export const ACTION_LABELS: Record<StudioAction, string> = {
  computer: "进入 Justin OS", canvas: "我的画布",
  works: "作品集", chair: "转动座椅",
  lamp: "台灯开关", clock: "显示日期",
  "drawer-top": "打开第一层抽屉", "drawer-middle": "打开第二层抽屉", "drawer-bottom": "打开第三层抽屉",
  diary: "阅读日记",
};
