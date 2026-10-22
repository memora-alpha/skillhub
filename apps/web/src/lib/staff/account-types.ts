export type MaterialState =
  "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "HIDDEN" | "ARCHIVED";

export type ModeratedMaterial = {
  id: string;
  ownerId: string;
  skillId: string;
  title: string;
  description: string;
  accessType: "FREE" | "PAID";
  priceCredit: string;
  listingVersion: number;
  status: MaterialState;
  scanStatus: string;
  moderationStatus: string;
  rejectReason: string | null;
  reviewedAt: string | null;
  distributionRightsConfirmedAt: string | null;
  file: {
    originalFilename: string | null;
    mimeType: string;
    sizeBytes: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type Wallet = {
  availableCredit: string;
  heldCredit: string;
  walletVersion: number;
};

export type CreditEntry = {
  id: string;
  operationId: string;
  type: string;
  amount: string;
  availableDelta: string;
  heldDelta: string;
  availableAfter: string;
  heldAfter: string;
  status: string;
  referenceType: string;
  referenceId: string;
  reversesTransactionId: string | null;
  createdAt: string;
};

export type ReputationHistory = {
  reputationScore: number;
  level: string;
  activeRestrictions: { scope: string; reasonCode: string; endsAt: string }[];
  items: {
    id: string;
    delta: number;
    scoreBefore: number;
    scoreAfter: number;
    reasonCode: string;
    sourceType: string;
    sourceId: string;
    createdAt: string;
  }[];
  nextCursor: string | null;
};

// Keep decimal strings exact: converting a BIGINT-backed balance to Number loses precision.
export function creditText(value: string): string {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return "—";
  const [whole = "0", decimal = "00"] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal.padEnd(2, "0")} Credit`;
}
