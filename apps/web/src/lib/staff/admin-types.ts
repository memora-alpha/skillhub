export type AdminUser = {
  userId: string;
  fullName: string;
  maskedEmail: string;
  accountStatus: string;
  roles: string[];
  createdAt: string;
};
export type CatalogSkill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type ModerationRules = {
  rules: { category: string; pattern: string }[];
  version: number;
  readAt: string;
};
export type AdminTag = {
  id: string;
  label: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
  createdAt: string | null;
  updatedAt: string;
};
export type TagRequest = {
  id: string;
  label: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  resultTagId: string | null;
  rejectReason: string | null;
  createdAt: string;
  version: number;
};
