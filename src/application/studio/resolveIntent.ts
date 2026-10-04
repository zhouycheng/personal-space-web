import type { AppPage } from "../../contracts/navigation";
import type { StudioIntent } from "../../contracts/studio";
import type { StudioTargets } from "../../contracts/studioPorts";

export type StudioCommand =
  | { kind: "navigate"; page: AppPage }
  | { kind: "scene"; action: Exclude<StudioIntent, "computer" | "canvas" | "works" | "diary"> };

export function resolveStudioIntent(intent: StudioIntent): StudioCommand {
  switch (intent) {
    case "computer": return { kind: "navigate", page: "os" };
    case "canvas": return { kind: "navigate", page: "canvas" };
    case "works": return { kind: "navigate", page: "works" };
    case "diary": return { kind: "navigate", page: "journal" };
    default: return { kind: "scene", action: intent };
  }
}

/** User toggles change the target once; rebuilding a scene only reapplies it. */
export function studioTargetsForIntent(targets: StudioTargets, intent: StudioIntent): StudioTargets {
  if (intent === "lamp") return { ...targets, lampOn: !targets.lampOn };
  if (intent === "clock") return { ...targets, showDate: !targets.showDate };
  const index = ["drawer-top", "drawer-middle", "drawer-bottom"].indexOf(intent);
  if (index < 0) return targets;
  return { ...targets, drawers: targets.drawers.map((open, position) => position === index ? !open : open) };
}
