import { ApiProperty } from "@nestjs/swagger";

export class LearningRequestModerationRuleResponse {
  @ApiProperty({ example: "SAFETY" })
  category!: string;

  @ApiProperty({ example: "unsafe phrase" })
  pattern!: string;
}

export class LearningRequestModerationRulesResponse {
  @ApiProperty({ type: [LearningRequestModerationRuleResponse] })
  rules!: LearningRequestModerationRuleResponse[];

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ format: "date-time" })
  readAt!: Date;
}
