export type CaseCapabilities = {
  hasHandler: boolean;
  canSendMessage: boolean;
  messageBlockedReason: string | null;
  canAttachEvidence: boolean;
  evidenceBlockedReason: string | null;
  ownEvidenceCount: number;
};
