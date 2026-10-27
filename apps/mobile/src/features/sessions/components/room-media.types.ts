import type { SessionsApi } from "../api/sessions-api";

export type RoomMediaProps = Readonly<{
  sessionId: string;
  api: SessionsApi;
  isCurrent: () => boolean;
  partnerName: string;
  onLeave: () => void;
  onRetry: () => void;
  retrying: boolean;
}>;
