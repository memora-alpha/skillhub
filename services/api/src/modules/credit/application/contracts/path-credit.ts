import type { SessionCreditIdentity } from "../../domain/session-credit";

export type PathHoldInput = {
  pathId: string;
  pathVersion: number;
  exchangeType: "TWO_WAY" | "ONE_WAY";
  participantAId: string;
  participantBId: string;
  teacherId: string | null;
  learnerId: string | null;
  totalCreditPerUser: bigint | null;
  negotiatedCredit: bigint | null;
  sessions: readonly SessionCreditIdentity[];
};
