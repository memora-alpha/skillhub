// Compatibility entry point for db:migrate: verify the complete v3 runtime.
// Never replace it with a legacy identity-only subset of the domain schema.
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
for (const name of [
  "SystemConfiguration",
  "User",
  "SkillCategory",
  "Skill",
  "SkillLevel",
  "Tag",
  "LearningRequest",
  "RequestTag",
  "RequestOffering",
  "Notification",
  "Role",
  "Permission",
  "RolePermission",
  "RefreshSession",
  "RefreshCredential",
  "ReauthProof",
  "IdentityEmailDelivery",
  "AvatarAsset",
  "AuditLog",
  "IdempotencyRecord",
  "OutboxEvent",
  "OutboxConsumerReceipt",
  "SystemConfigurationRevision",
  "StoredFile",
  "StoredFileScanEvent",
  "LearningPath",
  "LearningPlan",
  "Material",
]) {
  if (!source.includes(`model ${name} {`)) {
    throw new Error(
      `Runtime schema is missing ${name}; generate the v3 runtime before migrating.`,
    );
  }
}
console.log(
  "Using the full v3 runtime in prisma/schema.prisma, including foundation support (OTP is Redis-only).",
);
