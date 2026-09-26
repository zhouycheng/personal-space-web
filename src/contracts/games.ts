export interface GameDefinition {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly entryUrl: string;
}

export interface GameLauncher {
  open(game: GameDefinition): Promise<void>;
  close(): Promise<void>;
}
