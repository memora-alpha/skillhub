import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class DashboardPeriodResponse {
  @ApiProperty({ format: "date-time" }) from!: string;
  @ApiProperty({ format: "date-time" }) to!: string;
  @ApiProperty({ enum: ["UTC", "Asia/Ho_Chi_Minh"] }) timezone!: string;
  @ApiProperty({ enum: ["day", "month"] }) granularity!: string;
}

class BucketResponse {
  @ApiProperty({ example: "2026-11-14" }) key!: string;
  @ApiProperty({ format: "date-time" }) bucketStart!: string;
  @ApiProperty({ format: "date-time" }) bucketEnd!: string;
}

class LearningKpisResponse {
  @ApiProperty() pathsCreated!: number;
  @ApiProperty() pathsSettled!: number;
  @ApiProperty() sessionsScheduled!: number;
  @ApiProperty() completedScheduledSessions!: number;
}

class LearningActivityResponse extends BucketResponse {
  @ApiProperty() pathsCreated!: number;
  @ApiProperty() pathsSettled!: number;
  @ApiProperty() sessionsScheduled!: number;
  @ApiProperty() completedScheduledSessions!: number;
}

class PathStageResponse {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

class UserGrowthResponse extends BucketResponse {
  @ApiProperty() newUsers!: number;
}

class FeeSeriesResponse extends BucketResponse {
  @ApiProperty({ example: "15.00" }) collectedCredit!: string;
  @ApiProperty({ example: "1.50" }) refundedCredit!: string;
  @ApiProperty({ example: "13.50" }) netCredit!: string;
}

class PriorityItemResponse {
  @ApiProperty() type!: string;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) label!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  createdAt!: string | null;
}

class SnapshotResponse {
  @ApiProperty({ type: DashboardPeriodResponse })
  period!: DashboardPeriodResponse;
  @ApiProperty({ format: "date-time" }) asOf!: string;
}

export class DashboardLearningResponse extends SnapshotResponse {
  @ApiPropertyOptional({ type: LearningKpisResponse })
  kpis?: LearningKpisResponse;
  @ApiPropertyOptional({ type: [LearningActivityResponse] })
  learningActivity?: LearningActivityResponse[];
  @ApiPropertyOptional({ type: [PathStageResponse] })
  pathStages?: PathStageResponse[];
}

class OverviewKpisResponse extends LearningKpisResponse {
  @ApiProperty() newUsers!: number;
  @ApiProperty({ example: "13.50" }) netFeeCredit!: string;
}

export class DashboardOverviewResponse extends SnapshotResponse {
  @ApiPropertyOptional({ type: OverviewKpisResponse })
  kpis?: OverviewKpisResponse;
  @ApiPropertyOptional({ type: [LearningActivityResponse] })
  learningActivity?: LearningActivityResponse[];
  @ApiPropertyOptional({ type: [PathStageResponse] })
  pathStages?: PathStageResponse[];
  @ApiPropertyOptional({ type: [UserGrowthResponse] })
  userGrowth?: UserGrowthResponse[];
  @ApiPropertyOptional({ type: [FeeSeriesResponse] })
  feeSeries?: FeeSeriesResponse[];
  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "integer" },
  })
  attentionSummary?: Record<string, number>;
  @ApiPropertyOptional({ type: [PriorityItemResponse] })
  priorityItems?: PriorityItemResponse[];
}

class PaymentSeriesResponse extends BucketResponse {
  @ApiProperty() paidOrders!: number;
  @ApiProperty({ example: "15000" }) paidAmountVnd!: string;
  @ApiProperty({ example: "15.00" }) paidCreditAmount!: string;
}

class FinanceKpisResponse {
  @ApiProperty() paidOrders!: number;
  @ApiProperty({ example: "15000" }) paidAmountVnd!: string;
  @ApiProperty({ example: "15.00" }) paidCreditAmount!: string;
  @ApiProperty({ example: "13.50" }) netFeeCredit!: string;
}

class FinanceAttentionResponse {
  @ApiProperty() paymentsInReview!: number;
}

export class DashboardFinanceResponse extends SnapshotResponse {
  @ApiPropertyOptional({ type: FinanceKpisResponse })
  kpis?: FinanceKpisResponse;
  @ApiPropertyOptional({ type: [FeeSeriesResponse] })
  feeSeries?: FeeSeriesResponse[];
  @ApiPropertyOptional({ type: [PaymentSeriesResponse] })
  paymentSeries?: PaymentSeriesResponse[];
  @ApiPropertyOptional({ type: FinanceAttentionResponse })
  attentionSummary?: FinanceAttentionResponse;
}
