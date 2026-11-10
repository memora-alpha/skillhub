import { ApiProperty, type ApiResponseSchemaHost } from "@nestjs/swagger";

export const invalidScheduleDetailsSchema: ApiResponseSchemaHost["schema"] = {
  type: "object",
  required: ["invalidItems", "evaluatedAt", "durationMinutes"],
  properties: {
    evaluatedAt: {
      type: "string",
      format: "date-time",
      description: "Database time used for validation (UTC).",
    },
    durationMinutes: {
      type: "object",
      required: ["min", "max"],
      properties: {
        min: { type: "integer", minimum: 1 },
        max: { type: "integer", minimum: 1 },
      },
    },
    invalidItems: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      description:
        "Every invalid item in the current confirmed schedules. Resolve participant IDs to display names using existing participant data.",
      items: {
        type: "object",
        required: [
          "scheduleId",
          "scheduleVersion",
          "planId",
          "planVersion",
          "teacherId",
          "learnerId",
          "sessionNo",
          "startAt",
          "endAt",
          "reasons",
        ],
        properties: {
          scheduleId: { type: "string", format: "uuid" },
          scheduleVersion: { type: "integer", minimum: 1 },
          planId: { type: "string", format: "uuid" },
          planVersion: { type: "integer", minimum: 1 },
          teacherId: { type: "string", format: "uuid" },
          learnerId: { type: "string", format: "uuid" },
          sessionNo: { type: "integer", minimum: 1 },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          reasons: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            uniqueItems: true,
            items: {
              type: "string",
              enum: [
                "START_NOT_IN_FUTURE",
                "END_NOT_AFTER_START",
                "DURATION_TOO_SHORT",
                "DURATION_TOO_LONG",
              ],
            },
          },
        },
      },
    },
  },
};

export class LearningPathSummaryResponse {
  @ApiProperty({
    type: String,
    nullable: true,
    enum: [
      "PREPARING",
      "WAITING_START",
      "LEARNING",
      "LEARNING_FINISHED",
      "COMPLETED",
      "STOPPED",
    ],
  })
  learningStage!: string | null;
  @ApiProperty({ type: String, nullable: true }) stageReasonCode!:
    string | null;
  @ApiProperty({
    type: Object,
    description:
      "Learning/teaching completed and total counts, with the agreement version basis",
  })
  progress!: object;
  @ApiProperty({ type: Object, nullable: true }) nextSession!: object | null;
  @ApiProperty({ type: Number, minimum: 0 }) attentionCount!: number;
  @ApiProperty({ type: Object, nullable: true }) primaryAttention!:
    object | null;
  @ApiProperty({ type: Object }) primaryAction!: object;
  @ApiProperty({ type: Object }) settlement!: object;
  @ApiProperty({ format: "date-time" }) evaluatedAt!: string;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Related Learning Request title, or skill name for a direct connection; null when source metadata is unavailable.",
  })
  title!: string | null;
  @ApiProperty({ format: "uuid" }) conversationId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
    description:
      "New learning obligations stop at this approval time; Credit may still await existing outcomes.",
  })
  terminationApprovedAt!: string | null;
  @ApiProperty({ type: String, enum: ["ONE_WAY", "TWO_WAY"], nullable: true })
  exchangeType!: string | null;
  @ApiProperty({ format: "uuid" }) counterpartId!: string;
  @ApiProperty() currentVersion!: number;
  @ApiProperty({ type: Number, nullable: true }) lockedVersion!: number | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
