import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../prisma/", import.meta.url);
let schema = readFileSync(new URL("catalog.prisma", root), "utf8").replace(
  "../src/generated/prisma-catalog",
  "../src/generated/prisma",
);

function model(name, transform) {
  const pattern = new RegExp(String.raw`^model ${name} \{[\s\S]*?^\}`, "m");
  if (!pattern.test(schema)) throw new Error(`Missing v3 model ${name}`);
  schema = schema.replace(pattern, transform);
}
function fields(block, added) {
  return block.replace(/\n\}/, `\n${added}\n}`);
}

model("User", (block) =>
  fields(
    block,
    `
  otpChallenges OtpChallenge[]
  @@index([createdAt(sort: Desc), id(sort: Desc)])
  @@index([accountStatus, createdAt(sort: Desc), id(sort: Desc)])
`,
  ),
);
model("SystemConfiguration", (block) =>
  fields(
    block,
    `
  revisions SystemConfigurationRevision[]
`,
  ),
);
// Retain the deployed Learning Request names and invariants over the v3 catalog.
for (const name of ["SkillCategory", "Skill", "Notification"]) {
  model(name, (block) =>
    block.replaceAll("onUpdate: Restrict", "onUpdate: Cascade"),
  );
}
model("LearningRequest", (block) =>
  fields(
    block
      .replace(/\bcontentVersion\b/g, "version")
      .replace(/version(\s+Int)\b/, "version$1 @default(1)")
      .replace(/\bflaggedRules\b/g, "flaggedCategories")
      .replace(/\brejectReason\b/g, "moderationRejectReason")
      .replace(/\breviewedByUserId\b/g, "moderatedByUserId")
      .replace(/\breviewedAt\b/g, "moderatedAt")
      .replace(/\breviewedByUserIdRecord\b/g, "moderatedBy")
      .replace(
        /verifiedTeacherOnly(\s+Boolean)\b/,
        "verifiedTeacherOnly$1 @default(false)",
      )
      .replace(/status(\s+LearningRequestStatus)\b/, "status$1 @default(DRAFT)")
      .replace(
        /moderationStatus\s+String\s+@map\("moderation_status"\) @db.Text/,
        'moderationStatus RequestModerationStatus @default(NOT_REQUIRED) @map("moderation_status")',
      )
      .replaceAll("onUpdate: Restrict", "onUpdate: Cascade"),
    `
  moderationRuleSetVersion Int? @map("moderation_rule_set_version")
  moderationReviewedVersion Int? @map("moderation_reviewed_version")
  requestedExpiresAt DateTime? @map("requested_expires_at") @db.Timestamptz(3)
  expiryMode RequestExpiryMode @default(DEFAULT) @map("expiry_mode")
  publishedAt DateTime? @map("published_at") @db.Timestamptz(3)
  tagLinks RequestTag[] @relation("RequestTag_request")
  @@index([ownerId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([skillId, status, createdAt(sort: Desc), id(sort: Desc)])
  @@index([status, createdAt(sort: Desc), id(sort: Desc)])
`,
  ),
);
model("Notification", (block) =>
  fields(block, "  @@index([userId, createdAt(sort: Desc), id(sort: Desc)])"),
);
// Preserve the physical enum order established by the Learning Request migration.
schema = schema.replace(/enum LearningRequestStatus \{[\s\S]*?\n\}/, (block) =>
  block.replace(/  REJECTED\r?\n  OPEN/, "  OPEN\n  REJECTED"),
);
// Keep application names for equivalent fields while using v3 database columns.
model("RefreshSession", (block) =>
  fields(
    block,
    `
  @@index([userId, revokedAt, absoluteExpiresAt])
  @@index([absoluteExpiresAt])
`,
  ),
);
model("RefreshCredential", (block) =>
  fields(
    block.replace(/\busedAt\b/, "consumedAt"),
    `
  @@index([expiresAt])
`,
  ),
);
model("ReauthProof", (block) =>
  fields(
    block
      .replace(/\btokenDigest\b/, "digest")
      .replace(/\busedAt\b/, "consumedAt"),
    `
  @@index([expiresAt])
`,
  ),
);
model("AvatarAsset", (block) =>
  fields(
    block
      .replace(/\bstatus\b(?=\s+AvatarAssetStatus)/, "state")
      .replace(/\bmimeType\b(?=\s+String)/, "mime")
      .replace(/\bsizeBytes\b(?=\s+BigInt)/, "byteSize")
      .replace(/checksum(\s+)String\b/, "checksum$1String?"),
    `
  scanEvidence Json? @map("scan_evidence")
  checkedAt DateTime? @map("checked_at") @db.Timestamptz(3)
  expiresAt DateTime? @map("expires_at") @db.Timestamptz(3)
  @@index([state, expiresAt])
`,
  ),
);
model("AuditLog", (block) =>
  fields(
    block
      .replace(/@db.VarChar\(1000\)/, "@db.VarChar(2000)")
      .replace(/\bbeforeData\b/, "before")
      .replace(/\bafterData\b/, "after"),
    `
  requestId String? @map("request_id") @db.Text
  actorKind String? @map("actor_kind") @db.Text
  actorRoles String[] @default([]) @map("actor_roles")
  systemActor String? @map("system_actor") @db.Text
  correlationId String? @map("correlation_id") @db.Uuid
  @@index([actorId, createdAt])
  @@index([targetType, targetId, createdAt])
  @@index([createdAt, id])
`,
  ),
);
model("IdentityEmailDelivery", (block) =>
  fields(
    block
      .replace(/status(\s+EmailDeliveryStatus)/, "status$1 @default(PENDING)")
      .replace(/attempts(\s+Int)/, "attempts$1 @default(0)")
      .replace(
        /nextAttemptAt(\s+DateTime\?)/,
        "nextAttemptAt$1 @default(now())",
      ),
    `
  challengeId String? @map("challenge_id") @db.Uuid
  challenge OtpChallenge? @relation(fields: [challengeId], references: [id], onDelete: Restrict)
  encryptedRecipient Bytes @map("encrypted_recipient")
  encryptedPayload Bytes? @map("encrypted_payload")
  encryptionKeyId String @map("encryption_key_id") @db.VarChar(40)
  lastErrorCode String? @map("last_error_code") @db.VarChar(100)
  @@index([status, nextAttemptAt])
  @@index([status, leaseUntil])
  @@index([expiresAt])
  @@index([challengeId])
`,
  ),
);
model("OutboxEvent", (block) =>
  fields(
    block
      .replace(/\bid\b(?=\s+String)/, "eventId")
      .replace(/\beventType\b/, "type")
      .replace(/\baggregateVersion\b/, "version")
      .replace(/\bpublishedAt\b/, "deliveredAt")
      .replace(/\battempts\b(?=\s+Int)/, "totalAttempts")
      .replace(/totalAttempts(\s+Int)/, "totalAttempts$1 @default(0)"),
    `
  correlationId String @map("correlation_id") @db.Uuid
  availableAt DateTime @default(now()) @map("available_at") @db.Timestamptz(3)
  leaseToken String? @map("lease_token") @db.Uuid
  leaseUntil DateTime? @map("lease_until") @db.Timestamptz(3)
  cycleAttempts Int @default(0) @map("cycle_attempts")
  replayCount Int @default(0) @map("replay_count")
  failedAt DateTime? @map("failed_at") @db.Timestamptz(3)
  lastErrorCode String? @map("last_error_code")
  @@index([availableAt, createdAt])
`,
  ),
);
schema +=
  "\n\n// Support retained for implemented OTP, foundation and Learning Request services.\n" +
  readFileSync(new URL("runtime-support.prisma", root), "utf8");
schema = schema.replace(
  /^\/\/ Logical v3 catalog:[\s\S]*?\n\n/,
  "// Runtime: v3 domain models plus implemented OTP/foundation support.\n" +
    "// Generated by scripts/generate-runtime-schema.mjs; do not edit directly.\n" +
    "// Credit BigInt amounts use 100 units = 1 Credit.\n\n",
);
writeFileSync(new URL("schema.prisma", root), schema);
