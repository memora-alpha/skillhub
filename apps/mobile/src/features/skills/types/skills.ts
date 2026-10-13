export const skillLevels = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
] as const;
export const skillBadges = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export const batchStates = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SkillLevel = (typeof skillLevels)[number];
export type SkillBadge = (typeof skillBadges)[number];
export type BatchState = (typeof batchStates)[number];
export type CatalogSkill = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  description: string | null;
};
export type PublicSkill = {
  id: string;
  skill: CatalogSkill;
  level: SkillLevel;
  description: string;
  experienceYears: string | null;
  verificationStatus: SkillBadge;
};
export type BatchSummary = {
  id: string;
  status: BatchState;
  submittedAt: string;
  rejectReason: string | null;
};
export type OwnSkill = PublicSkill & {
  isVisible: boolean;
  archivedAt: string | null;
  version: number;
  latestVerification: BatchSummary | null;
};
export type Evidence = {
  id: string;
  title: string | null;
  description: string | null;
  mimeType: string;
  fileSizeBytes: string;
  approvalStatus: BatchState | "REVOKED";
  rejectReason: string | null;
  revokedReason: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
};
export type Verification = BatchSummary & {
  sharingSkillId: string;
  version: number;
  reviewedAt: string | null;
  note: string | null;
  files: Evidence[];
};
export type FileStatus = { fileId: string; state: string };
export type SkillInput = {
  skillId: string;
  level: SkillLevel;
  description: string;
  experienceYears: string | null;
  isVisible: boolean;
};
export type SkillPatch = Partial<Omit<SkillInput, "skillId">> & {
  expectedVersion: number;
};
export type VerificationInput = {
  fileIds: string[];
  title?: string;
  description?: string;
};
export const levelLabels: Record<SkillLevel, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXPERT: "Chuyên gia",
};
export const badgeLabels: Record<SkillBadge, string> = {
  UNVERIFIED: "Chưa xác minh",
  PENDING: "Đang chờ xác minh",
  VERIFIED: "Đã xác minh",
  REJECTED: "Chưa được duyệt",
};
export const decisionLabels: Record<BatchState | "REVOKED", string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  REVOKED: "Đã thu hồi",
};
