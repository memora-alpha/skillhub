import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional()
  payload!: unknown;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  readAt!: Date | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: Date;
}
