import { ApiProperty } from "@nestjs/swagger";
export class FeePolicyResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["ONE_WAY", "TWO_WAY", "MATERIAL_PAID"] })
  policyCode!: string;
  @ApiProperty() versionNo!: number;
  @ApiProperty({ type: Object }) calculationRule!: unknown;
  @ApiProperty({ type: Object }) roundingRule!: unknown;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  approvedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  effectiveAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  approvedByUserId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) createdBy!:
    string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}
export class ListedFeePolicyResponse extends FeePolicyResponse {
  @ApiProperty({
    description:
      "This is the currently selected effective version for this policy code",
  })
  effective!: boolean;
}
export class FeeRevenueItemResponse {
  @ApiProperty() period!: string;
  @ApiProperty() business!: string;
  @ApiProperty({ description: "Credit decimal string" })
  collectedCredit!: string;
  @ApiProperty() refundedCredit!: string;
  @ApiProperty() netCredit!: string;
}
export class FeeRevenueResponse {
  @ApiProperty({ format: "date-time" }) from!: string;
  @ApiProperty({ format: "date-time" }) to!: string;
  @ApiProperty({ enum: ["UTC"] }) timezone!: string;
  @ApiProperty({ enum: ["day", "month"] }) granularity!: string;
  @ApiProperty() basis!: string;
  @ApiProperty({ type: [FeeRevenueItemResponse] })
  items!: FeeRevenueItemResponse[];
}
