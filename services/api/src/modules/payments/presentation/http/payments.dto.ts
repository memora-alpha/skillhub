import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Equals,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { PaymentStatus } from "../../../../generated/prisma/client";

export class CreatePaymentDto {
  @ApiProperty({
    type: String,
    example: "100000",
    description: "Integer VND; 1000–2000000, step 1000. 1000 VND = 1 Credit.",
  })
  @IsString()
  @Matches(/^[1-9]\d{3,6}$/)
  paymentAmountVnd!: string;
  @ApiProperty({ enum: ["PAYOS"] })
  @Equals("PAYOS")
  gateway!: "PAYOS";
}
export class PaymentQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({ maxLength: 1024 })
  @IsOptional()
  @IsString()
  @Length(1, 1024)
  cursor?: string;
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
export class PaymentQrResponse {
  @ApiProperty({ enum: ["PENDING"] }) providerStatus!: string;
  @ApiProperty() paymentLinkId!: string;
  @ApiProperty({ type: String }) orderCode!: string;
  @ApiProperty({ description: "Render this payload as QR in SkillHub" })
  qrCode!: string;
}
export class PaymentResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["PAYOS"] }) gateway!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ type: String, example: "100000" }) paymentAmountVnd!: string;
  @ApiProperty({ example: "VND" }) currency!: string;
  @ApiProperty({ type: String, example: "100.00" }) creditAmount!: string;
  @ApiProperty({ example: 1000 }) conversionRateVndPerCredit!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  paidAt!: Date | null;
  @ApiProperty() version!: number;
  @ApiProperty({ type: PaymentQrResponse, nullable: true })
  checkout!: PaymentQrResponse | null;
}
