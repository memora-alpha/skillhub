import { randomUUID } from "node:crypto";

export function aiSnapshot(overrides = {}) {
  return {
    verificationId: randomUUID(),
    verificationVersion: 1,
    sharingVersion: 2,
    applicant: {
      fullName: "Fixture User",
      nameSource: "SELF_DECLARED_PROFILE",
    },
    skill: {
      id: randomUUID(),
      name: "Chinese",
      description: null,
      sharingDescription: "A teaching skill description",
      declaredLevel: "Intermediate",
      levelDescription: null,
    },
    reviewPolicy: null,
    files: [
      {
        evidenceId: randomUUID(),
        storedFileId: randomUUID(),
        checksum: "a".repeat(64),
        mimeType: "image/png",
        sizeBytes: 5,
        title: null,
        description: null,
      },
    ],
    ...overrides,
  };
}

export function aiFileResult(file, overrides = {}) {
  return {
    evidenceId: file.evidenceId,
    documentType: "Examination Score Report",
    languages: ["Chinese", "English"],
    readability: "READABLE",
    extractedFields: {
      holderName: "Fixture User",
      documentTitle: "HSK 5",
      issuer: "Fixture Issuer",
      certificateNumber: null,
      examinationDate: null,
      issuedAt: null,
      expiresAt: null,
      result: "218/300",
    },
    dateSources: { examinationDate: null, issuedAt: null, expiresAt: null },
    nameMatch: "MATCH",
    skillRelevance: "RELEVANT",
    levelAssessment: "UNKNOWN",
    issuerVerification: "UNVERIFIED",
    tamperingAssessment: "NO_OBVIOUS_SIGNS",
    flags: [],
    findings: [
      {
        code: "RESULT",
        observation: "Điểm trên tài liệu là 218/300",
        assessment:
          "Có liên quan kỹ năng tiếng Trung; chưa xác thực tại nguồn.",
        sources: [{ page: 1, quote: "218" }],
      },
    ],
    recommendation: "SUPPORTS_SKILL",
    summary: "Minh chứng liên quan; Staff cần kiểm tra.",
    ...overrides,
  };
}

export const aiConfig = {
  enabled: true,
  apiKey: "fixture-provider-key-only",
  model: "gemini-2.5-flash",
  timeoutMs: 5000,
  maxOutputTokens: 8192,
  maxInputTokens: 16000,
  maxRuns: 3,
};
