import { z } from "zod";
import { AI_MIME_TYPES, VerificationAiError } from "./verification-ai.config";

const text = z.string().max(2000);
const nullableText = text.nullable();
const date = z.iso.date().nullable();
const source = z.strictObject({
  page: z.number().int().min(1).max(1000),
  quote: z.string().min(1).max(1000),
});
const recommendation = z.enum([
  "SUPPORTS_SKILL",
  "NEEDS_REVIEW",
  "INSUFFICIENT_EVIDENCE",
]);

export const aiFileResultSchema = z.strictObject({
  evidenceId: z.uuid(),
  documentType: nullableText,
  languages: z.array(z.string().max(80)).max(10),
  readability: z.enum(["READABLE", "PARTIALLY_READABLE", "UNREADABLE"]),
  extractedFields: z.strictObject({
    holderName: nullableText,
    documentTitle: nullableText,
    issuer: nullableText,
    certificateNumber: nullableText,
    examinationDate: date,
    issuedAt: date,
    expiresAt: date,
    result: nullableText,
  }),
  dateSources: z.strictObject({
    examinationDate: source.nullable(),
    issuedAt: source.nullable(),
    expiresAt: source.nullable(),
  }),
  nameMatch: z.enum([
    "MATCH",
    "PARTIAL",
    "MISMATCH",
    "UNKNOWN",
    "NOT_APPLICABLE",
  ]),
  skillRelevance: z.enum(["RELEVANT", "PARTIAL", "NOT_RELEVANT", "UNKNOWN"]),
  // There is no approved equivalence policy or issuer lookup in this capability.
  levelAssessment: z.literal("UNKNOWN"),
  issuerVerification: z.literal("UNVERIFIED"),
  tamperingAssessment: z.enum([
    "NO_OBVIOUS_SIGNS",
    "SUSPICIOUS",
    "INCONCLUSIVE",
  ]),
  flags: z.array(z.string().max(80)).max(20),
  findings: z
    .array(
      z.strictObject({
        code: z.string().max(80),
        observation: text,
        assessment: text,
        sources: z.array(source).max(8),
      }),
    )
    .max(20),
  recommendation,
  summary: text,
});

export type AiFileResult = z.infer<typeof aiFileResultSchema>;
export type AiResult = {
  files: AiFileResult[];
  batchRecommendation: AiFileResult["recommendation"];
  batchSummary: string;
};

export const aiSnapshotSchema = z.strictObject({
  verificationId: z.uuid(),
  verificationVersion: z.number().int(),
  sharingVersion: z.number().int(),
  applicant: z.strictObject({
    fullName: z.string().max(255),
    nameSource: z.literal("SELF_DECLARED_PROFILE"),
  }),
  skill: z.strictObject({
    id: z.uuid(),
    name: text,
    description: nullableText,
    sharingDescription: text,
    declaredLevel: nullableText,
    levelDescription: nullableText,
  }),
  reviewPolicy: z.null(),
  files: z
    .array(
      z.strictObject({
        evidenceId: z.uuid(),
        storedFileId: z.uuid(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/i),
        mimeType: z.string().max(100),
        sizeBytes: z.number().int().positive().max(10000000),
        title: nullableText,
        description: nullableText,
      }),
    )
    .min(1)
    .max(5),
});
export type AiSnapshot = z.infer<typeof aiSnapshotSchema>;
export type AiFileInput = AiSnapshot["files"][number];

export function parseAiFileResult(
  value: unknown,
  file: AiFileInput,
): AiFileResult {
  const parsed = aiFileResultSchema.safeParse(value);
  if (!parsed.success || parsed.data.evidenceId !== file.evidenceId)
    throw new VerificationAiError("AI_INVALID_OUTPUT", true);
  const result = parsed.data;
  const dates = ["examinationDate", "issuedAt", "expiresAt"] as const;
  const missingDateEvidence = dates.some(
    (key) =>
      (result.extractedFields[key] === null) !==
      (result.dateSources[key] === null),
  );
  const sources = [
    ...result.findings.flatMap((finding) => finding.sources),
    ...Object.values(result.dateSources).filter((item) => item !== null),
  ];
  const imageWithInvalidPage =
    file.mimeType !== "application/pdf" &&
    sources.some((item) => item.page !== 1);
  const suspiciousWithoutEvidence =
    result.tamperingAssessment === "SUSPICIOUS" &&
    !result.findings.some((finding) => finding.sources.length > 0);
  const unsupportedApproval =
    result.recommendation === "SUPPORTS_SKILL" &&
    (result.readability !== "READABLE" ||
      result.nameMatch !== "MATCH" ||
      result.skillRelevance !== "RELEVANT" ||
      result.tamperingAssessment !== "NO_OBVIOUS_SIGNS" ||
      sources.length === 0);
  if (
    missingDateEvidence ||
    imageWithInvalidPage ||
    suspiciousWithoutEvidence ||
    unsupportedApproval
  )
    throw new VerificationAiError("AI_UNGROUNDED_OUTPUT", true);
  return result;
}

export function aggregateAiResults(files: AiFileResult[]): AiResult {
  if (!files.length) throw new VerificationAiError("AI_EMPTY_OUTPUT");
  const same = files.every(
    (file) => file.recommendation === files[0]!.recommendation,
  );
  const batchRecommendation = same ? files[0]!.recommendation : "NEEDS_REVIEW";
  return {
    files,
    batchRecommendation,
    batchSummary:
      "Đề xuất hỗ trợ Staff xem xét. Tính xác thực tại đơn vị cấp chưa được kiểm chứng. " +
      files.map((file) => file.summary).join(" "),
  };
}

export function supportsAiSnapshot(snapshot: AiSnapshot): boolean {
  return snapshot.files.every((file) => AI_MIME_TYPES.has(file.mimeType));
}
