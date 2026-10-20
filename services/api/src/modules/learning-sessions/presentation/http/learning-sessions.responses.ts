import { ApiProperty } from "@nestjs/swagger";
import type { Prisma } from "../../../../generated/prisma/client";

/** Public projection: never return room metadata or provider-internal identifiers. */
export const sessionReadSelect = {
  id: true,
  pathId: true,
  planId: true,
  planVersion: true,
  outlineSessionNo: true,
  teacherId: true,
  learnerId: true,
  startAt: true,
  endAt: true,
  status: true,
  teacherConfirmationStatus: true,
  teacherConfirmedAt: true,
  teacherConfirmationNote: true,
  learnerConfirmationStatus: true,
  learnerConfirmedAt: true,
  learnerConfirmationNote: true,
  teacherFirstJoinedAt: true,
  teacherLastLeftAt: true,
  teacherAttendanceSeconds: true,
  learnerFirstJoinedAt: true,
  learnerLastLeftAt: true,
  learnerAttendanceSeconds: true,
} satisfies Prisma.SessionSelect;

export class LiveKitTokenResponse {
  @ApiProperty() serverUrl!: string;
  @ApiProperty() participantToken!: string;
  @ApiProperty() roomName!: string;
  @ApiProperty() participantIdentity!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) joinOpensAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) joinClosesAt!: Date;
}
