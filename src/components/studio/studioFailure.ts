export type StudioFailureStage = "module" | "initialization" | "context" | "shader" | "render" | "context-lost";

export class StudioFailure extends Error {
  stage: StudioFailureStage;
  constructor(stage: StudioFailureStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.stage=stage;
    this.name = "StudioFailure";
  }
}

export function studioFailure(error: unknown, stage: StudioFailureStage) {
  return error instanceof StudioFailure ? error : new StudioFailure(stage, error);
}

export function canRetryStudio(error: StudioFailure, lightweight: boolean, disposed: boolean) {
  return !disposed && !lightweight && ["context", "shader", "render"].includes(error.stage);
}
