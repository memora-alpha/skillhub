import type { SessionsApi } from "../api/sessions-api";

export type RoomMediaProps = Readonly<{
  sessionId: string;
  api: SessionsApi;
  isCurrent: () => boolean;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  partnerIdentity: string;
  startCamera: boolean;
  startMicrophone: boolean;
  onScreenShareChange: (sharing: boolean) => void;
  onLeave: () => void;
  onRetry: () => void;
  retrying: boolean;
}>;
