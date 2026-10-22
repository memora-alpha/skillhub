import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";

export type OwnProfile = {
  userId: string;
  fullName: string;
  headline: string;
  bio: string;
  timezone: string | null;
  locale: "vi" | "en";
  avatarUrl: string | null;
  reputationScore: number | null;
  verifiedSkillCount: number;
  completedSessionCount: number;
  selectedTitle?: string | null;
};
export type OwnIdentity = {
  userId: string;
  email: string;
  emailVerified: boolean;
  accountStatus:
    "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "SUSPENDED" | "DEACTIVATED";
  roles: string[];
  profile: OwnProfile;
};
export type ProfilePatch = Partial<
  Pick<OwnProfile, "fullName" | "headline" | "bio" | "timezone" | "locale">
>;
const nullableString = (value: unknown) =>
  value === null || typeof value === "string";
const count = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export function parseProfile(value: unknown): OwnProfile {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    typeof value.fullName !== "string" ||
    typeof value.headline !== "string" ||
    typeof value.bio !== "string" ||
    !nullableString(value.timezone) ||
    !nullableString(value.avatarUrl) ||
    (value.selectedTitle !== undefined &&
      !nullableString(value.selectedTitle)) ||
    !["vi", "en"].includes(String(value.locale)) ||
    !(
      value.reputationScore === null ||
      (typeof value.reputationScore === "number" &&
        Number.isFinite(value.reputationScore))
    ) ||
    !count(value.verifiedSkillCount) ||
    !count(value.completedSessionCount)
  )
    throw new AppError("protocol");
  return { ...value, selectedTitle: value.selectedTitle ?? null } as OwnProfile;
}
export function parseIdentity(value: unknown): OwnIdentity {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    typeof value.email !== "string" ||
    typeof value.emailVerified !== "boolean" ||
    ![
      "PENDING_VERIFICATION",
      "ACTIVE",
      "LOCKED",
      "SUSPENDED",
      "DEACTIVATED",
    ].includes(String(value.accountStatus)) ||
    !Array.isArray(value.roles) ||
    value.roles.length !== 1 ||
    typeof value.roles[0] !== "string"
  )
    throw new AppError("protocol");
  const profile = parseProfile(value.profile);
  if (profile.userId !== value.userId) throw new AppError("protocol");
  return { ...value, profile } as OwnIdentity;
}
