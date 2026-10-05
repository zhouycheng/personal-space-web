export type StartupStage = 'module' | 'geometry' | 'texture' | 'shader' | 'first-frame' | 'ready';
/** Progress counts completed preparation stages; it is not a byte percentage. */
export type StartupProgress = { stage: StartupStage; progress: number };
