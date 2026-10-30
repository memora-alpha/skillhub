import { ApiProperty } from "@nestjs/swagger";

class AiSourceResponse {
  @ApiProperty({ minimum: 1, maximum: 1000 }) page!: number;
  @ApiProperty({ maxLength: 1000 }) quote!: string;
}
class AiDatesResponse {
  @ApiProperty({ type: AiSourceResponse, nullable: true })
  examinationDate!: AiSourceResponse | null;
  @ApiProperty({ type: AiSourceResponse, nullable: true })
  issuedAt!: AiSourceResponse | null;
  @ApiProperty({ type: AiSourceResponse, nullable: true })
  expiresAt!: AiSourceResponse | null;
}
class AiFieldsResponse {
  @ApiProperty({ type: String, nullable: true }) holderName!: string | null;
  @ApiProperty({ type: String, nullable: true }) documentTitle!: string | null;
  @ApiProperty({ type: String, nullable: true }) issuer!: string | null;
  @ApiProperty({ type: String, nullable: true }) certificateNumber!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: "date" })
  examinationDate!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date" }) issuedAt!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: "date" }) expiresAt!:
    string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Visible component and total scores; no invented pass threshold.",
  })
  result!: string | null;
}
class AiFindingResponse {
  @ApiProperty() code!: string;
  @ApiProperty() observation!: string;
  @ApiProperty() assessment!: string;
  @ApiProperty({ type: [AiSourceResponse], maxItems: 8 })
  sources!: AiSourceResponse[];
}
class AiFileResponse {
  @ApiProperty({ format: "uuid" }) evidenceId!: string;
  @ApiProperty({ type: String, nullable: true }) documentType!: string | null;
  @ApiProperty({ type: [String] }) languages!: string[];
  @ApiProperty({ enum: ["READABLE", "PARTIALLY_READABLE", "UNREADABLE"] })
  readability!: string;
  @ApiProperty({ type: AiFieldsResponse }) extractedFields!: AiFieldsResponse;
  @ApiProperty({ type: AiDatesResponse }) dateSources!: AiDatesResponse;
  @ApiProperty({
    enum: ["MATCH", "PARTIAL", "MISMATCH", "UNKNOWN", "NOT_APPLICABLE"],
  })
  nameMatch!: string;
  @ApiProperty({ enum: ["RELEVANT", "PARTIAL", "NOT_RELEVANT", "UNKNOWN"] })
  skillRelevance!: string;
  @ApiProperty({ enum: ["UNKNOWN"] }) levelAssessment!: string;
  @ApiProperty({
    enum: ["UNVERIFIED"],
    description:
      "No issuer lookup or digital-signature verification has been performed.",
  })
  issuerVerification!: string;
  @ApiProperty({
    enum: ["NO_OBVIOUS_SIGNS", "SUSPICIOUS", "INCONCLUSIVE"],
    description:
      "Visual advisory signal only; absence of signs does not prove authenticity.",
  })
  tamperingAssessment!: string;
  @ApiProperty({ type: [String], maxItems: 20 }) flags!: string[];
  @ApiProperty({ type: [AiFindingResponse], maxItems: 20 })
  findings!: AiFindingResponse[];
  @ApiProperty({
    enum: ["SUPPORTS_SKILL", "NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE"],
  })
  recommendation!: string;
  @ApiProperty() summary!: string;
}
class AiUsageResponse {
  @ApiProperty() inputTokens!: number;
  @ApiProperty({
    description:
      "Generated output including thinking tokens as reported in total minus input.",
  })
  outputTokens!: number;
  @ApiProperty() totalTokens!: number;
}
export class VerificationAiResultResponse {
  @ApiProperty({ type: [AiFileResponse], minItems: 1, maxItems: 5 })
  files!: AiFileResponse[];
  @ApiProperty({
    enum: ["SUPPORTS_SKILL", "NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE"],
  })
  batchRecommendation!: string;
  @ApiProperty() batchSummary!: string;
  @ApiProperty({ type: AiUsageResponse }) usage!: AiUsageResponse;
}
class AiApplicantResponse {
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ["SELF_DECLARED_PROFILE"] }) nameSource!: string;
}
class AiSkillResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() sharingDescription!: string;
  @ApiProperty({ type: String, nullable: true }) declaredLevel!: string | null;
  @ApiProperty({ type: String, nullable: true }) levelDescription!:
    string | null;
}
export class VerificationAiContextResponse {
  @ApiProperty({ type: AiApplicantResponse }) applicant!: AiApplicantResponse;
  @ApiProperty({ type: AiSkillResponse }) skill!: AiSkillResponse;
  @ApiProperty({
    type: "object",
    additionalProperties: false,
    nullable: true,
    enum: [null],
    description: "No certificate equivalence/expiry policy has been approved.",
  })
  reviewPolicy!: null;
}
