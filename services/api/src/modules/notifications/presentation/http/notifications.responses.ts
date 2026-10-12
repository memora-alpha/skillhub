import { ApiProperty } from "@nestjs/swagger";

export class NotificationResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ nullable: true })
  payload!: unknown;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  readAt!: Date | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;
}
