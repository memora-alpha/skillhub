import { ApiProperty } from "@nestjs/swagger";
import {
  CreditReferenceType,
  CreditTransactionStatus,
  CreditTransactionType,
} from "../../../../generated/prisma/client";

const money = {
  type: String,
  pattern: "^-?[0-9]+\\.[0-9]{2}$",
  example: "100.00",
};
export class WalletResponse {
  @ApiProperty(money) availableCredit!: string;
  @ApiProperty(money) heldCredit!: string;
  @ApiProperty({ type: Number }) walletVersion!: number;
}

export class LedgerEntryResponse {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) operationId!: string;
  @ApiProperty({ enum: CreditTransactionType }) type!: CreditTransactionType;
  @ApiProperty(money) amount!: string;
  @ApiProperty(money) availableDelta!: string;
  @ApiProperty(money) heldDelta!: string;
  @ApiProperty(money) availableAfter!: string;
  @ApiProperty(money) heldAfter!: string;
  @ApiProperty({ enum: CreditTransactionStatus })
  status!: CreditTransactionStatus;
  @ApiProperty({ enum: CreditReferenceType })
  referenceType!: CreditReferenceType;
  @ApiProperty() referenceId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  reversesTransactionId!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
}
