export type StudioState = "room" | "entering" | "desktop" | "returning" | "entering-canvas" | "canvas" | "returning-canvas" | "journal" | "entering-journal" | "returning-journal";
import type { RoomViewAction } from "./studioMotion";
export type StudioAction = "computer" | "canvas" | "works" | "chair" | "lamp" | "clock" | "drawer-top" | "drawer-middle" | "drawer-bottom" | "diary" | RoomViewAction;
export const DIARY_URL = "/journal";
export const ACTION_LABELS: Record<StudioAction, string> = {
  computer: "进入 Justin OS", canvas: "我的画布",
  works: "文件夹", chair: "转动座椅",
  lamp: "台灯开关", clock: "显示日期",
  "drawer-top": "打开第一层抽屉", "drawer-middle": "打开第二层抽屉", "drawer-bottom": "打开第三层抽屉",
  diary: "阅读日记",
  "zoom-in": "放大场景", "zoom-out": "缩小场景", "reset-view": "重置视角",
  "view-left":"向左转动", "view-right":"向右转动", "view-up":"抬高视角", "view-down":"降低视角",
};
