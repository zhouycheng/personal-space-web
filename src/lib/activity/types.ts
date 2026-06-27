export type ActivityWireState = "active" | "inactive";

export interface ActivityUpdatePayload {
  appName: string | null;
  state: ActivityWireState;
  observedAt?: number;
  sessionId?: string | null;
}

export interface ActivitySnapshot {
  appName: string;
  text: string | null;
  observedAt: number;
  receivedAt: number;
  expiresAt: number;
  sessionId?: string | null;
}
