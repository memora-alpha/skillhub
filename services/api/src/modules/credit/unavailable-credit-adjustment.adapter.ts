import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { CreditAdjustmentPort } from "./credit.ports";

/** Placeholder until SH-068 provides adjustment/reversal primitives. */
@Injectable()
export class UnavailableCreditAdjustmentAdapter implements CreditAdjustmentPort {
  adjust(): Promise<{ operationId: string }> {
    return Promise.reject(
      new ServiceUnavailableException("CREDIT_ADJUSTMENT_UNAVAILABLE"),
    );
  }

  reverse(): Promise<{ operationId: string }> {
    return Promise.reject(
      new ServiceUnavailableException("CREDIT_ADJUSTMENT_UNAVAILABLE"),
    );
  }
}
