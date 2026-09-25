import type { AppPage } from "../../contracts/navigation";
import type { StudioIntent } from "../../contracts/studio";

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
