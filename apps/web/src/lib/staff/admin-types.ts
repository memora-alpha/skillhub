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
