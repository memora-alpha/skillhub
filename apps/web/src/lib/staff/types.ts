export type StaffIdentity = {
  userId: string;
  fullName: string;
  roles: string[];
};
export type Pagination = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};
export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: { pagination?: Pagination };
};
export type EvidenceFile = {
  id: string;
  title: string | null;
  description: string | null;
  mimeType: string;
  fileSizeBytes: string;
  approvalStatus: string;
  approvedAt: string | null;
  rejectReason: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};
export type Verification = {
  id: string;
  sharingSkillId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  version: number;
  submittedAt: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  note: string | null;
  rejectReason: string | null;
  files: EvidenceFile[];
};
export type LearningRequest = {
  id: string;
  ownerId: string;
  skillId: string;
  title: string;
  description: string;
  learningGoal: string;
  currentLevel: string | null;
  verifiedTeacherOnly: boolean;
  teachingOverview: string | null;
  desiredCreditPerHour: string | null;
  offeredSharingSkills?: {
    id: string;
    skill: { id: string; name: string };
    level: string;
    verificationStatus: string;
  }[];
  preferredAvailability: {
    timeZone: string;
    weeklySlots: { weekday: string; startTime: string; endTime: string }[];
  } | null;
  preferredSlots: { startAt: string; endAt: string }[];
  tagIds: string[];
  proposedTags: string[];
  status: string;
  moderationStatus: string;
  flaggedCategories: string[];
  moderationRejectReason: string | null;
  moderatedByUserId: string | null;
  moderatedAt: string | null;
  version: number;
  createdAt: string;
};
export type ReportEvidence = {
  id: string;
  mimeType: string;
  fileSizeBytes: string;
  uploadedAt: string;
};
export type ReportCase = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  relatedSessionId: string | null;
  relatedPathId: string | null;
  relatedMaterialId?: string | null;
  relatedOrderId?: string | null;
  reasonCode: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "NEED_MORE_INFO" | "RESOLVED" | "REJECTED";
  handlerId: string | null;
  blocksSettlement: boolean;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reportEvidenceCaseIdRecords?: ReportEvidence[];
};
export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};
export type ReportCaseDetail = ReportCase & {
  session: {
    id: string;
    planId: string;
    teacherId: string;
    learnerId: string;
    startAt: string;
    endAt: string;
    status: string;
    teacherConfirmationStatus: string;
    learnerConfirmationStatus: string;
  } | null;
  path: {
    id: string;
    status: string;
    participantAId: string;
    participantBId: string;
    lockedVersion: number | null;
    settledAt: string | null;
  } | null;
};
export type DownloadLink = { url: string; expiresAt: string };
