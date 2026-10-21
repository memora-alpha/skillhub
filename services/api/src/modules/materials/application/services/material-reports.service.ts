import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { requirePermission } from "./material-support";

const ACTIVE_CASE = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] as const;

/**
 * SRS 18.41: MATERIAL reports need no learningPathId/sessionId. Staff resolve them in the
 * existing /reports/staff queue, which reads the database, so no outbox event is written;
 * relatedOrderId is the refund hook for when OP-14 lands.
 */
@Injectable()
export class MaterialReportsService {
  constructor(private readonly transactions: TransactionRunner) {}

  async report(
    principal: Principal,
    materialId: string,
    input: { reasonCode: string; description: string },
  ) {
    requirePermission(principal, "material:access");
    const description = input.description.trim();
    if (description.length < 10)
      throw new BadRequestException("MATERIAL_TEXT_INVALID");
    return this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: materialId },
      });
      const entitlement = material
        ? await tx.materialEntitlement.findUnique({
            where: {
              userId_materialId: { userId: principal.userId, materialId },
            },
            select: { sourceOrderId: true },
          })
        : null;
      const visible =
        material?.status === "PUBLISHED" ||
        material?.ownerId === principal.userId ||
        entitlement !== null;
      if (!material || !visible)
        throw new NotFoundException("MATERIAL_NOT_FOUND");
      // No unique index backs "one active report"; concurrent duplicates are
      // stopped by the runner's Serializable isolation plus retry.
      const active = await tx.reportCase.findFirst({
        where: {
          reporterId: principal.userId,
          relatedMaterialId: materialId,
          status: { in: [...ACTIVE_CASE] },
        },
        select: { id: true },
      });
      if (active) throw new ConflictException("ACTIVE_MATERIAL_REPORT_EXISTS");
      const id = randomUUID();
      const relatedOrderId = entitlement?.sourceOrderId ?? null;
      await tx.reportCase.create({
        data: {
          id,
          reporterId: principal.userId,
          targetType: "MATERIAL",
          targetId: materialId,
          relatedMaterialId: materialId,
          relatedOrderId,
          reasonCode: input.reasonCode,
          description,
          status: "OPEN",
          blocksSettlement: false,
        },
      });
      return { id, status: "OPEN", relatedOrderId };
    });
  }
}
