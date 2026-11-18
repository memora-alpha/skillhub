export type Wallet = {
  availableCredit: string;
  heldCredit: string;
  walletVersion: number;
};
export type LedgerEntry = {
  id: string;
  type: string;
  amount: string;
  availableDelta: string;
  heldDelta: string;
  availableAfter: string;
  heldAfter: string;
  status: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};
export type Payment = {
  id: string;
  status: string;
  paymentAmountVnd: string;
  creditAmount: string;
  createdAt: string;
  expiresAt: string | null;
  recoveryRequired: boolean;
  recoveryReason: string | null;
  checkout: {
    qrCode: string;
    orderCode: string;
    paymentLinkId: string;
    providerStatus: string;
  } | null;
};
export type PaymentPolicy = {
  canCreate: boolean;
  reasonCode: string | null;
  existingPaymentId: string | null;
};
export type Material = {
  coverFileId?: string | null;
  thumbnail?:
    | {
        kind: "GENERATED";
        smallUrl: string;
        largeUrl: string;
        expiresAt: string;
      }
    | { kind: "PLACEHOLDER"; format: string };
  ratingSummary?: import("../types").MaterialRatingSummary;
  id: string;
  ownerId: string;
  skillId: string;
  title: string;
  description: string;
  accessType: "FREE" | "PAID";
  priceCredit: string;
  listingVersion: number;
  status: string;
  file: {
    originalFilename: string | null;
    mimeType: string;
    sizeBytes: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};
export type MaterialOrder = {
  id: string;
  materialId: string;
  listingVersion: number;
  grossCredit: string;
  status: string;
  createdAt: string;
  purchasedMaterial?: {
    title: string | null;
    originalFilename: string | null;
    mimeType: string | null;
    sizeBytes: string | null;
  };
  review?: {
    hasReview: boolean;
    reviewId: string | null;
    status: string | null;
    version: number | null;
    sourceOrderId: string | null;
    canReview: boolean;
    reasonCode: string | null;
  };
  refundEligibility?: {
    canRefund: boolean;
    deadline: string;
    reasonCode: string | null;
    evaluatedAt: string;
  };
};
export type OwnedMaterial = Material & {
  hasBeenPublished: boolean;
  canEdit: boolean;
  editBlockedReason: string | null;
  rejectReason: string | null;
  cover?: {
    attached: boolean;
    generation: number;
    file: {
      id: string;
      originalFilename: string | null;
      mimeType: string;
      sizeBytes: string | null;
      state: string;
      scanVerdict: string;
    } | null;
    processingStatus: string;
    failureCode: string | null;
    preview: Material["thumbnail"];
  };
};
export type OwnIdentity = {
  userId: string;
  email: string;
  profile: {
    avatarUrl: string | null;
    fullName: string;
    headline: string;
    bio: string;
    reputationScore: number;
    verifiedSkillCount: number;
    completedSessionCount: number;
    completedLearningPathCount: number;
    reviewSummary?: import("./profile-reviews").ReviewSummary;
    profileModeration?: Record<
      string,
      { action: string; reason: string; at: string }
    > | null;
    timezone: string | null;
    locale: string;
    selectedTitle: string | null;
  };
};
export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};
export type ReportCase = {
  handlerId: string | null;
  id: string;
  status: string;
  reasonCode: string;
  description: string;
  relatedSessionId: string | null;
  relatedPathId: string | null;
  relatedMaterialId: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  blocksSettlement: boolean;
  createdAt: string | null;
  reportEvidenceCaseIdRecords: {
    id: string;
    mimeType: string;
    fileSizeBytes: string;
    uploadedAt: string;
  }[];
};
