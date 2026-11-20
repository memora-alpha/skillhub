import { createHash, randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { ContentModerationService } from "../../../content-moderation/application/content-moderation.service";
import type { ModerationSurface } from "../../../content-moderation/domain/moderation-policy";

export const reportModerationEvent = "report.content.moderation";
export const reportModerationKinds = [
  "CASE_REPORT",
  "CASE_MESSAGE",
  "CASE_EVIDENCE",
  "MATERIAL_REVIEW_REPORT",
] as const;
type ReportModerationKind = (typeof reportModerationKinds)[number];
export type ReportModerationReference = {
  kind: ReportModerationKind;
  sourceId: string;
};

export const reportModerationSurface = {
  CASE_REPORT: "report",
  CASE_MESSAGE: "case_message",
  CASE_EVIDENCE: "report_evidence",
  MATERIAL_REVIEW_REPORT: "report",
} as const satisfies Record<ReportModerationKind, ModerationSurface>;

export const staffContentAssessment = {
  kind: true,
  sourceId: true,
  status: true,
  reasonCodes: true,
  policyVersion: true,
  classifierVersion: true,
  assessmentId: true,
} as const;

export function reportTextDigest(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function queueReportText(
  tx: TransactionContext,
  moderation: ContentModerationService | undefined,
  source: {
    kind: Exclude<ReportModerationKind, "CASE_EVIDENCE">;
    sourceId: string;
    caseId?: string;
    text: string;
  },
) {
  const mode = moderation?.mode(reportModerationSurface[source.kind]);
  if (!mode || mode === "off") return;
  const { kind, sourceId, caseId, text } = source;
  await queue(tx, {
    kind,
    sourceId,
    caseId,
    sourceVersion: "1",
    digest: reportTextDigest(text),
    restricted: mode === "enforce" && kind !== "MATERIAL_REVIEW_REPORT",
  });
}

export async function reportEvidenceVersion(
  tx: TransactionContext,
  caseId: string,
  fileId: string,
) {
  const file = await tx.storedFile.findFirst({
    where: {
      id: fileId,
      purpose: "REPORT",
      resourceType: "REPORT_EVIDENCE",
      resourceId: caseId,
      state: "READY",
      scanVerdict: "CLEAN",
    },
    select: { generation: true, sha256: true },
  });
  if (!file?.sha256) return null;
  return { sourceVersion: `${fileId}:${file.generation}`, digest: file.sha256 };
}

export async function queueReportEvidence(
  tx: TransactionContext,
  moderation: ContentModerationService | undefined,
  evidence: { id: string; caseId: string; storedFileId: string | null },
) {
  const mode = moderation?.mode(reportModerationSurface.CASE_EVIDENCE);
  if (!mode || mode === "off" || !evidence.storedFileId) return;
  const version = await reportEvidenceVersion(
    tx,
    evidence.caseId,
    evidence.storedFileId,
  );
  if (!version) return;
  await queue(tx, {
    kind: "CASE_EVIDENCE",
    sourceId: evidence.id,
    caseId: evidence.caseId,
    restricted: mode === "enforce",
    ...version,
  });
}

async function queue(
  tx: TransactionContext,
  source: ReportModerationReference & {
    caseId?: string;
    sourceVersion: string;
    digest: string;
    restricted: boolean;
  },
) {
  await tx.reportContentModeration.create({ data: source });
  await tx.outboxEvent.create({
    data: {
      aggregateType: "REPORT_CONTENT_MODERATION",
      aggregateId: source.sourceId,
      version: 1,
      type: reportModerationEvent,
      payload: { kind: source.kind, sourceId: source.sourceId },
      dedupeKey: `report-content-moderation:${source.kind}:${source.sourceId}`,
      correlationId: randomUUID(),
    },
  });
}
