export type CleanupCandidate = { id: string; objectKey: string };

export interface ReconciliationRepository {
  claimCleanup(graceBefore: Date, limit: number): Promise<CleanupCandidate[]>;
  markDeleted(id: string): Promise<void>;
  reconcileExpiredScans(limit: number): Promise<number>;
}
