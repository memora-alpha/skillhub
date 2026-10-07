import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../prisma/", import.meta.url);
const source = readFileSync(new URL("schema.prisma", root), "utf8");
const allModels = new Set(
  [...source.matchAll(/^model (\w+)/gm)].map((match) => match[1]),
);
const models = new Set([
  "SystemConfiguration",
  "User",
  "SkillCategory",
  "Skill",
  "Tag",
  "LearningRequest",
  "RequestTag",
  "Notification",
  "Profile",
  "Role",
  "Permission",
  "UserRole",
  "RolePermission",
  "OtpChallenge",
  "OtpIssueWindow",
  "RefreshSession",
  "RefreshCredential",
  "ReauthProof",
  "IdentityEmailDelivery",
  "AvatarAsset",
  "AuditLog",
  // Foundation tables (SH-003..006) deployed by the same migration history.
  "IdempotencyRecord",
  "OutboxEvent",
  "OutboxConsumerReceipt",
  "SystemConfigurationRevision",
  "StoredFile",
  "StoredFileScanEvent",
]);
const enums = new Set([
  "AccountStatus",
  "CatalogStatus",
  "LearningLevel",
  "LearningRequestStatus",
  "RequestModerationStatus",
  "RequestExpiryMode",
  "NotificationChannel",
  "RoleCode",
  "ProfileLocale",
  "OtpPurpose",
  "ReauthPurpose",
  "IdentityEmailKind",
  "EmailDeliveryStatus",
  "AvatarAssetStatus",
]);
const blocks = source.match(
  /^(?:generator|datasource|model|enum) \w+ \{[\s\S]*?^\}/gm,
);
const selected = blocks
  .filter((block) => {
    const [, kind, name] = /^(\w+) (\w+)/.exec(block);
    return (
      kind === "generator" ||
      kind === "datasource" ||
      (kind === "model" ? models.has(name) : enums.has(name))
    );
  })
  .map((block) => {
    const [, kind, name] = /^(\w+) (\w+)/.exec(block);
    if (kind !== "model" || !models.has(name)) return block;
    return block
      .split("\n")
      .filter((line) => {
        const field = /^\s+\w+\s+(\w+)/.exec(line);
        return !field || !allModels.has(field[1]) || models.has(field[1]);
      })
      .join("\n");
  });
writeFileSync(
  fileURLToPath(new URL("identity.prisma", root)),
  "// Generated from schema.prisma by scripts/write-identity-schema.mjs. Identity deployment scope only.\n" +
    selected.join("\n\n") +
    "\n",
);
