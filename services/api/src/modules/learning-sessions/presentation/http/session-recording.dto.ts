import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RECORDING_STATUSES } from "../../domain/recording.policy";

const nullableDate = {
  type: String,
  format: "date-time",
  nullable: true,
} as const;

export class SessionRecordingResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  sessionId!: string;

  @ApiProperty({ enum: RECORDING_STATUSES })
  status!: string;

  @ApiProperty({ enum: ["ROOM_COMPOSITE_VIDEO", "AUDIO_ONLY"] })
  kind!: string;

  @ApiProperty({ format: "uuid" })
  requestedByUserId!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  acceptedByUserId!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  requestedAt!: Date;

  @ApiPropertyOptional(nullableDate)
  startedAt!: Date | null;

  @ApiPropertyOptional(nullableDate)
  endedAt!: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  bytes!: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: [
      "PARTICIPANT",
      "WINDOW_CLOSED",
      "ROOM_FINISHED",
      "MAX_DURATION",
      "DISABLED",
    ],
  })
  stopReason!: string | null;

  @ApiPropertyOptional({
    ...nullableDate,
    description:
      "READY recordings only: endAt + recording.retentionDays. An open report keeps the recording past it (heldByReport).",
  })
  expiresAt!: Date | null;

  @ApiProperty({
    description:
      "True while an open report targets or relates to the Session; deletion is refused and expiry waits.",
  })
  heldByReport!: boolean;

  @ApiPropertyOptional(nullableDate)
  deletedAt!: Date | null;
}

export class SessionRecordingPlaybackResponse {
  @ApiProperty({
    description:
      "Presigned GET with Content-Disposition inline, valid until expiresAt. Request a new one when it expires.",
  })
  url!: string;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: Date;

  @ApiProperty({ enum: ["video/mp4", "audio/mp4"] })
  mime!: string;
}

export class StaffSessionRecordingPlaybackResponse extends SessionRecordingPlaybackResponse {
  @ApiProperty({ format: "uuid" })
  caseId!: string;
}

export class SessionRecordingListResponse {
  @ApiProperty({ type: [SessionRecordingResponse] })
  items!: SessionRecordingResponse[];
}
