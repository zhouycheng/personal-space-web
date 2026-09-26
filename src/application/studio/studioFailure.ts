import type { StudioFailure } from "../../contracts/studioFailure";

export function canRetryStudio(error: StudioFailure, lightweight: boolean, disposed: boolean) {
  return !disposed && !lightweight && ["context", "shader", "render"].includes(error.stage);
}
