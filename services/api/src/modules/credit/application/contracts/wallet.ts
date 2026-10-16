import type {
  CreditReferenceType,
  CreditTransactionStatus,
  CreditTransactionType,
} from "../../../../generated/prisma/client";

export type WalletRecord = {
  userId: string;
  availableCredit: bigint;
  heldCredit: bigint;
  walletVersion: number;
  lastEntrySequence: bigint;
};

export type LedgerFilter = {
  type?: CreditTransactionType;
  referenceType?: CreditReferenceType;
};
export type LedgerQuery = LedgerFilter & { cursor?: string; limit: number };
export type LedgerBoundary = { watermark: bigint; before?: bigint };

export type LedgerEntry = {
  id: string;
  operationId: string;
  type: CreditTransactionType;
  amount: bigint;
  availableDelta: bigint;
  heldDelta: bigint;
  availableAfter: bigint;
  heldAfter: bigint;
  status: CreditTransactionStatus;
  referenceType: CreditReferenceType;
  referenceId: string;
  reversesTransactionId: string | null;
  createdAt: Date;
  entrySequence: bigint;
};

export type WalletView = {
  availableCredit: string;
  heldCredit: string;
  walletVersion: number;
};
export type LedgerEntryView = Omit<
  LedgerEntry,
  | "amount"
  | "availableDelta"
  | "heldDelta"
  | "availableAfter"
  | "heldAfter"
  | "entrySequence"
> & {
  amount: string;
  availableDelta: string;
  heldDelta: string;
  availableAfter: string;
  heldAfter: string;
};
export type LedgerPage = {
  data: LedgerEntryView[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
};
