import { Injectable } from "@nestjs/common";
import type {
  ReportContentModeration,
  ReportMessageReceipt,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  ContentModerationService,
  type ModerationAssessment,
} from "../../../content-moderation/application/content-moderation.service";
import { moderationPolicyVersion } from "../../../content-moderation/domain/moderation-policy";
import {
  reportEvidenceVersion,
  reportModerationSurface,
  reportTextDigest,
  type ReportModerationReference,
} from "../../application/services/report-content-moderation";
import { CaseMessageRepository } from "../persistence/case-message.repository";

const pendingStates = ["PENDING", "RETRY"];
type Version = Pick<ReportContentModeration, "sourceVersion" | "digest">;
type Source = Version & {
  text?: string;
  receipt?: Pick<
    ReportMessageReceipt,
    "caseId" | "partyId" | "senderId" | "digest"
  >;
};

function matches<T extends Version>(
  version: T | null,
  item: Version,
): version is T {
  return (
    version?.sourceVersion === item.sourceVersion &&
    version.digest === item.digest
  );
}

function fromText(text: string) {
  return { sourceVersion: "1", digest: reportTextDigest(text), text };
}

@Injectable()
export class ReportContentModerationProcessor {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly messages: CaseMessageRepository,
    private readonly moderation: ContentModerationService,
  ) {}

  async process(reference: ReportModerationReference): Promise<void> {
    const { kind, sourceId } = reference;
    const initial = await this.transactions.run(async (tx) => {
      const item = await tx.reportContentModeration.findFirst({
        where: { kind, sourceId, status: { in: pendingStates } },
      });
      if (!item) return null;
      return { item, source: await this.source(tx, reference, item) };
    });
    if (!initial) return;
    const { item, source } = initial;
    const assessment = matches(source, item)
      ? await this.evaluate(kind, item, source)
      : null;
    const status = await this.transactions.run(async (tx) => {
      const current = await this.source(tx, reference, item);
      const assessmentStatus =
        assessment?.observedOutcome ?? assessment?.outcome;
      const status =
        assessmentStatus && matches(current, item)
          ? assessmentStatus
          : "SUPERSEDED";
      const result = await tx.reportContentModeration.updateMany({
        where: {
          kind,
          sourceId,
          caseId: item.caseId,
          sourceVersion: item.sourceVersion,
          digest: item.digest,
          status: { in: pendingStates },
        },
        data: {
          status,
          ...(status === "SUPERSEDED" || !assessment
            ? {}
            : {
                reasonCodes: assessment.reasonCodes,
                policyVersion: assessment.policyVersion,
                classifierVersion: assessment.classifierVersion ?? null,
                assessmentId: assessment.assessmentId ?? null,
                restricted: item.restricted && status !== "ALLOW",
              }),
        },
      });
      return result.count === 1 ? status : null;
    });
    if (status === "RETRY") throw new Error("REPORT_MODERATION_RETRY");
  }

  private async source(
    tx: TransactionContext,
    { kind, sourceId }: ReportModerationReference,
    { caseId }: ReportContentModeration,
  ): Promise<Source | null> {
    switch (kind) {
      case "CASE_REPORT": {
        if (caseId !== sourceId) return null;
        const row = await tx.reportCase.findUnique({
          where: { id: sourceId },
          select: { description: true },
        });
        return row && fromText(row.description);
      }
      case "MATERIAL_REVIEW_REPORT": {
        const row = await tx.materialReviewReport.findUnique({
          where: { id: sourceId },
          select: { description: true },
        });
        return row && fromText(row.description);
      }
      case "CASE_MESSAGE": {
        const row = await tx.reportMessageReceipt.findUnique({
          where: { messageId: sourceId },
          select: { caseId: true, partyId: true, senderId: true, digest: true },
        });
        return row?.caseId === caseId
          ? { sourceVersion: "1", digest: row.digest, receipt: row }
          : null;
      }
      case "CASE_EVIDENCE": {
        if (!caseId) return null;
        const row = await tx.reportEvidence.findFirst({
          where: { id: sourceId, caseId },
          select: { storedFileId: true },
        });
        return row?.storedFileId
          ? reportEvidenceVersion(tx, caseId, row.storedFileId)
          : null;
      }
    }
  }

  private async evaluate(
    kind: ReportModerationReference["kind"],
    item: ReportContentModeration,
    source: Source,
  ): Promise<ModerationAssessment> {
    const { sourceVersion, digest } = item;
    if (kind === "CASE_EVIDENCE") {
      // Evidence stays in case storage until its data-sharing policy is approved.
      return {
        sourceVersion,
        digest,
        outcome: "REVIEW",
        reasonCodes: ["PRIVATE_EVIDENCE_REVIEW_REQUIRED"],
        policyVersion: moderationPolicyVersion,
      };
    }
    const surface = reportModerationSurface[kind];
    if (this.moderation.mode(surface) === "off")
      return {
        sourceVersion,
        digest,
        outcome: "RETRY",
        reasonCodes: ["MODERATION_PAUSED"],
        policyVersion: moderationPolicyVersion,
      };
    let text: string;
    if (source.receipt) {
      const { receipt } = source;
      const [message] = await this.messages.read([item.sourceId]);
      if (
        message?._id !== item.sourceId ||
        message.caseId !== receipt.caseId ||
        message.partyId !== receipt.partyId ||
        message.senderId !== receipt.senderId ||
        message.digest !== digest ||
        typeof message.text !== "string" ||
        reportTextDigest(message.text) !== digest
      ) {
        throw new Error("CASE_MESSAGE_CONTENT_UNAVAILABLE");
      }
      text = message.text;
    } else {
      if (source.text === undefined)
        throw new Error("REPORT_MODERATION_TEXT_MISSING");
      text = source.text;
    }
    const assessment = await this.moderation.evaluate({
      surface,
      sourceVersion,
      digest,
      text,
    });
    if (!matches(assessment, item))
      throw new Error("REPORT_MODERATION_VERSION_MISMATCH");
    return assessment;
  }
}
