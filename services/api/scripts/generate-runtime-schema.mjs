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
  createdTags Tag[] @relation("Tag_creator")
  tagCreationRequests TagCreationRequest[] @relation("TagRequest_owner")
  reviewedTagCreationRequests TagCreationRequest[] @relation("TagRequest_reviewer")
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
  proposedTags String[] @default([]) @map("proposed_tags")
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
    block.replace(
      /candidateSlots\s+Json\s+@default\("\[\]"\) @map\("candidate_slots"\)/,
      'candidateSlots String? @map("candidate_slots") @db.Text',
    ),
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
model("Conversation", (block) =>
  fields(
    block,
    `
  lastActivityAt DateTime @default(now()) @map("last_activity_at") @db.Timestamptz(3)
  @@index([participantAId, lastActivityAt(sort: Desc), id(sort: Desc)], map: "conversations_participant_a_activity_idx")
  @@index([participantBId, lastActivityAt(sort: Desc), id(sort: Desc)], map: "conversations_participant_b_activity_idx")
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
  fields(block, "  REVIEW\n  CANCELLED"),
);
model("Payment", (block) =>
  fields(
    block,
    `  payosCheckout PayosCheckout?
  creationKeyDigest String? @map("creation_key_digest") @db.Char(64)
  creationFingerprint String? @map("creation_fingerprint") @db.Char(64)
  @@unique([userId, creationKeyDigest])
  @@index([userId, status, createdAt, id])`,
  ),
);
model("CreditOperation", (block) =>
  fields(
    block,
    '  instructionDigest String? @map("instruction_digest") @db.Char(64)',
  ),
);
// Session no-show (spec 012): attendance evidence, deadlines and two outcome states.
schema = schema.replace(/enum SessionStatus \{[\s\S]*?\n\}/, (block) =>
  fields(block, "  NO_SHOW\n  MAKEUP_REQUIRED"),
);
model("UserRestriction", (block) =>
  fields(
    block,
    `
  triggerEventKey String? @map("trigger_event_key") @db.VarChar(255)
  policyRequired Boolean @default(false) @map("policy_required")
  policyAcknowledgedAt DateTime? @map("policy_acknowledged_at") @db.Timestamptz(3)
  reviewDecision String? @map("review_decision") @db.Text
  reviewedAt DateTime? @map("reviewed_at") @db.Timestamptz(3)
`,
  ),
);
model("Session", (block) =>
  fields(
    block,
    `
  teacherTokenIssuedAt DateTime? @map("teacher_token_issued_at") @db.Timestamptz(3)
  learnerTokenIssuedAt DateTime? @map("learner_token_issued_at") @db.Timestamptz(3)
  lastObservedAt DateTime? @map("last_observed_at") @db.Timestamptz(3)
  observationFailedAt DateTime? @map("observation_failed_at") @db.Timestamptz(3)
  confirmDeadlineAt DateTime? @map("confirm_deadline_at") @db.Timestamptz(3)
  makeupDeadlineAt DateTime? @map("makeup_deadline_at") @db.Timestamptz(3)
  attendanceIntervals SessionAttendanceInterval[] @relation("AttendanceInterval_session")
  attendanceOutcomes SessionAttendanceOutcome[] @relation("AttendanceOutcome_session")
  @@index([status, confirmDeadlineAt])
  @@index([status, makeupDeadlineAt])
`,
  ),
);
model("User", (block) =>
  fields(
    block,
    `
  attendanceIntervals SessionAttendanceInterval[] @relation("AttendanceInterval_user")
  absenceExcuses SessionAbsenceExcuse[] @relation("AbsenceExcuse_absent_user")
  decidedAbsenceExcuses SessionAbsenceExcuse[] @relation("AbsenceExcuse_decider")
`,
  ),
);
// System-opened cases (no-show timeouts) have no human reporter.
model("ReportCase", (block) =>
  block
    .replace(
      /\bid(\s+)String\b/,
      'createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz(3)\n  id$1String',
    )
    .replace(/\breporterId(\s+)String\b/, "reporterId$1String?")
    .replace(/\breporterIdRecord(\s+)User\b/, "reporterIdRecord$1User?"),
);

// Learning changes own their request history; Session identities remain stable for makeup.
model("HeldCreditAllocation", (block) =>
  fields(
    block,
    '  sessionCreditSnapshot Json? @map("session_credit_snapshot") @db.JsonB',
  ),
);
model("LearningPath", (block) =>
  fields(
    block,
    `
  participantASettlementApprovedAt DateTime? @map("participant_a_settlement_approved_at") @db.Timestamptz(3)
  reputationRewardedAt DateTime? @map("reputation_rewarded_at") @db.Timestamptz(3)
  terminationApprovedAt DateTime? @map("termination_approved_at") @db.Timestamptz(3)
  participantBSettlementApprovedAt DateTime? @map("participant_b_settlement_approved_at") @db.Timestamptz(3)
  changeRequests LearningChangeRequest[]
  settlementAttempt PathSettlementAttempt?
`,
  ),
);
model("Session", (block) =>
  fields(
    block,
    `
  originalStartAt DateTime? @map("original_start_at") @db.Timestamptz(3)
  rescheduleCount Int @default(0) @map("reschedule_count")
  makeupCount Int @default(0) @map("makeup_count")
  makeupUserIds String[] @default([]) @map("makeup_user_ids") @db.Uuid
  changeRequests LearningChangeRequest[]
  @@unique([id, pathId])
`,
  ),
);
model("User", (block) =>
  fields(
    block,
    `
  requestedLearningChanges LearningChangeRequest[] @relation("LearningChange_requester")
  respondedLearningChanges LearningChangeRequest[] @relation("LearningChange_responder")
  resolvedLearningChanges LearningChangeRequest[] @relation("LearningChange_resolver")
`,
  ),
);
model("CreditOperation", (block) =>
  fields(
    block,
    `
  learningChange LearningChangeRequest?
`,
  ),
);
schema += "\n" + readFileSync(new URL("learning-changes.prisma", root), "utf8");

// Incident grouping, classification and committed private-message metadata (spec 014).
model("User", (block) =>
  fields(
    block,
    `
  handledReportIncidents ReportIncident[]
  caseMessagePartyReceipts ReportMessageReceipt[] @relation("CaseMessage_party")
  caseMessageSenderReceipts ReportMessageReceipt[] @relation("CaseMessage_sender")
  privateReportEvidence ReportEvidence[]
`,
  ),
);
model("StoredFile", (block) =>
  fields(block, "  privateReportEvidence ReportEvidence?"),
);
model("ReportEvidence", (block) =>
  fields(
    block,
    `
  partyId String? @map("party_id") @db.Uuid
  storedFileId String? @unique @map("stored_file_id") @db.Uuid
  party User? @relation(fields: [partyId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  storedFile StoredFile? @relation(fields: [storedFileId], references: [id], onDelete: Restrict, onUpdate: Restrict)
`,
  ),
);
model("ReportCase", (block) =>
  fields(
    block,
    `
  severity String? @db.VarChar(8)
  version Int @default(1)
  incidentId String? @map("incident_id") @db.Uuid
  incident ReportIncident? @relation(fields: [incidentId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  messageReceipts ReportMessageReceipt[]
  @@index([incidentId], map: "report_cases_incident_idx")
`,
  ),
);
schema += "\n" + readFileSync(new URL("report-support.prisma", root), "utf8");

// Staff participation and per-account operational grants (spec 014).
model("SkillVerification", (block) =>
  fields(
    block,
    '  submittedRole String? @map("submitted_role") @db.VarChar(10)',
  ),
);
model("User", (block) =>
  fields(
    block,
    `
  staffPermissionVersion Int @default(0) @map("staff_permission_version")
  permissionOverrides UserPermissionOverride[] @relation("PermissionOverride_target")
  assignedPermissionOverrides UserPermissionOverride[] @relation("PermissionOverride_actor")
`,
  ),
);
model("Permission", (block) =>
  fields(block, "  userOverrides UserPermissionOverride[]"),
);
schema +=
  "\n" + readFileSync(new URL("staff-permissions.prisma", root), "utf8");

// Global Admin pagination indices (spec 014).
model("CreditTransaction", (block) =>
  fields(
    block,
    '  @@index([createdAt(sort: Desc), id(sort: Desc)], map: "credit_transactions_admin_order_idx")',
  ),
);
model("Payment", (block) =>
  fields(
    block,
    '  @@index([createdAt(sort: Desc), id(sort: Desc)], map: "payments_admin_order_idx")',
  ),
);

// Completion-gap data is additive; existing accounts keep enabled notifications.
model("User", (block) =>
  fields(
    block,
    `
  notificationPreferences Json? @map("notification_preferences")
  profileModeration Json? @map("profile_moderation")
  createdFeePolicies FeePolicyVersion[] @relation("FeePolicy_creator")
`,
  ),
);
model("Review", (block) =>
  fields(
    block,
    '  moderationVersion Int @default(0) @map("moderation_version")',
  ),
);
model("FeePolicyVersion", (block) =>
  fields(
    block,
    `
  createdBy String? @map("created_by") @db.Uuid
  createdByRecord User? @relation("FeePolicy_creator", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Restrict)
  @@index([createdBy], map: "fee_policies_creator_idx")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
`,
  ),
);

model("SharingSkill", (block) =>
  fields(
    block,
    '  @@index([userId, createdAt(sort: Desc), id(sort: Desc)], map: "sharing_skills_user_created_idx")',
  ),
);
model("Session", (block) =>
  fields(
    block,
    `
  @@index([teacherId, startAt, id], map: "sessions_teacher_page_idx")
  @@index([learnerId, startAt, id], map: "sessions_learner_page_idx")
`,
  ),
);
model("Material", (block) =>
  fields(
    block,
    `
  @@index([ownerId, updatedAt(sort: Desc), id(sort: Desc)], map: "materials_owner_page_idx")
  @@index([status, updatedAt, id], map: "materials_staff_page_idx")
`,
  ),
);
model("MaterialOrder", (block) =>
  fields(
    block,
    '  @@index([buyerId, createdAt(sort: Desc), id(sort: Desc)], map: "material_orders_buyer_page_idx")',
  ),
);
model("FeePolicyVersion", (block) =>
  fields(
    block,
    '  @@index([createdAt(sort: Desc), id(sort: Desc)], map: "fee_policies_page_idx")',
  ),
);

schema = schema.replace(
  /^\/\/ Logical v3[^\r\n]*\r?\n(?:\/\/[^\r\n]*\r?\n)*\r?\n/,
  "// Runtime: v3 domain models plus implemented foundation support.\n" +
    "// Generated by scripts/generate-runtime-schema.mjs; do not edit directly.\n" +
    "// Credit BigInt amounts use 100 units = 1 Credit.\n\n",
);
writeFileSync(new URL("schema.prisma", root), schema);
