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

// Domain approval names differ from the historical PostgreSQL enum label.
schema = schema.replace(
  /(enum VerificationRequestStatus \{[\s\S]*?)\bVERIFIED\b/,
  '$1APPROVED @map("VERIFIED")',
);
for (const name of ["Skill", "SharingSkill"]) {
  model(name, (block) =>
    fields(
      block,
      `
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  version Int @default(1)
  ${name === "Skill" ? 'nameKey String @unique @map("name_key") @db.Text' : ""}
`,
    ),
  );
}
model("SkillVerification", (block) =>
  fields(block, "  version Int @default(1)"),
);
model("SkillEvidence", (block) =>
  fields(
    block,
    `
  storedFileId String? @unique @map("stored_file_id") @db.Uuid
  storedFile StoredFile? @relation(fields: [storedFileId], references: [id], onDelete: Restrict)
`,
  ),
);

model("User", (block) =>
  fields(
    block,
    `
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
  teachingOverview String? @map("teaching_overview") @db.VarChar(3000)
  preferredAvailability Json? @map("preferred_availability")
  desiredCreditPerHour BigInt? @map("desired_credit_per_hour")
  offeringLinks RequestOffering[] @relation("RequestOffering_request")
  @@index([ownerId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([skillId, status, createdAt(sort: Desc), id(sort: Desc)])
  @@index([status, createdAt(sort: Desc), id(sort: Desc)])
`,
  ),
);
model("SharingSkill", (block) =>
  fields(
    block.replace(/level(\s+)SharingSkillLevel\b/, "level$1SharingSkillLevel?"),
    `  requestOfferings RequestOffering[] @relation("RequestOffering_sharing")
  levelId String? @map("level_id") @db.Uuid
  levelIdRecord SkillLevel? @relation(fields: [skillId, levelId], references: [skillId, id], onDelete: Restrict, onUpdate: Restrict)
  @@index([skillId, levelId])`,
  ),
);
model("Skill", (block) => fields(block, "  levels SkillLevel[]"));
model("Notification", (block) =>
  fields(block, "  @@index([userId, createdAt(sort: Desc), id(sort: Desc)])"),
);
model("Proposal", (block) =>
  fields(
    block,
    `
  version Int @default(1)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(3)
  terminalAt DateTime? @map("terminal_at") @db.Timestamptz(3)
  exchangeTypeHint ExchangeType? @map("exchange_type_hint")
  targetSharingSkillId String? @map("target_sharing_skill_id") @db.Uuid
  @@index([status, expiresAt])
  @@index([proposerId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([recipientId, createdAt(sort: Desc), id(sort: Desc)])
`,
  ),
);
// Preserve the physical enum order established by the Learning Request migration.
schema = schema.replace(/enum LearningRequestStatus \{[\s\S]*?\n\}/, (block) =>
  block.replace(/ {2}REJECTED\r?\n {2}OPEN/, "  OPEN\n  REJECTED"),
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
  @@index([status, nextAttemptAt])
  @@index([status, leaseUntil])
  @@index([expiresAt])
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
  "\n\n// Support retained for implemented foundation and Learning Request services.\n" +
  readFileSync(new URL("runtime-support.prisma", root), "utf8");
// Financial entry order is assigned under the owning wallet lock by a DB trigger.
model("CreditWallet", (block) =>
  fields(
    block,
    `  lastEntrySequence BigInt @default(0) @map("last_entry_sequence")
  provenanceTracked Boolean @default(false) @map("provenance_tracked")`,
  ),
);
model("CreditTransaction", (block) =>
  fields(
    block,
    `  entrySequence BigInt @default(0) @map("entry_sequence")
  @@unique([userId, entrySequence])`,
  ),
);
schema = schema.replace(/enum PaymentStatus \{[\s\S]*?\n\}/, (block) =>
  fields(block, "  REVIEW"),
);
model("Payment", (block) => fields(block, "  payosCheckout PayosCheckout?"));
model("CreditOperation", (block) =>
  fields(
    block,
    '  instructionDigest String? @map("instruction_digest") @db.Char(64)',
  ),
);
schema = schema.replace(
  /^\/\/ Logical v3[^\r\n]*\r?\n(?:\/\/[^\r\n]*\r?\n)*\r?\n/,
  "// Runtime: v3 domain models plus implemented foundation support.\n" +
    "// Generated by scripts/generate-runtime-schema.mjs; do not edit directly.\n" +
    "// Credit BigInt amounts use 100 units = 1 Credit.\n\n",
);
writeFileSync(new URL("schema.prisma", root), schema);
