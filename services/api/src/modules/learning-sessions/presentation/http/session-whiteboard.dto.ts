import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, Max, Min } from "class-validator";

export class SaveSessionWhiteboardDto {
  @ApiProperty({
    minimum: 0,
    description:
      "Revision the client last loaded; 0 creates the first snapshot. A stale value returns 409 WHITEBOARD_REVISION_CONFLICT with currentRevision.",
  })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedRevision!: number;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description:
      "Excalidraw scene { elements, appState?, files? }; at most 2 MiB of UTF-8 JSON and 20,000 elements with unique ids.",
  })
  @IsObject()
  sceneData!: Record<string, unknown>;
}

export class SessionWhiteboardResponse {
  @ApiProperty({ minimum: 0, description: "0 when nothing has been saved" })
  revision!: number;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    nullable: true,
  })
  sceneData!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  updatedAt!: Date | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  updatedByUserId!: string | null;

  @ApiProperty({
    description:
      "True outside the room join window or when the Session is not joinable",
  })
  readOnly!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: [
      "SESSION_NOT_JOINABLE",
      "LIVEKIT_POLICY_NOT_READY",
      "JOIN_WINDOW_NOT_OPEN",
      "JOIN_WINDOW_CLOSED",
    ],
  })
  readOnlyReason!: string | null;
}

export class SessionWhiteboardSaveResponse {
  @ApiProperty({ minimum: 1 })
  revision!: number;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}
