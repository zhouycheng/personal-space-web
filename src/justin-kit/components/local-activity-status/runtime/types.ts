/** Client-facing payload accepted by the reusable status component. */
export type ActivitySnapshot = {
  appName: string;
  text: string | null;
  observedAt: number;
  receivedAt: number;
  expiresAt: number;
  sessionId?: string | null;
};
