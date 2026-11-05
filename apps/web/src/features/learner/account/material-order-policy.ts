import { UserApiError } from "../api/client";
import type { MaterialOrder } from "./account-types";
/** The controller projects result.order directly into data; there is no data.order. */
export function readRefundedOrder(
  value: unknown,
  orderId: string,
): MaterialOrder {
  if (!value || typeof value !== "object")
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  const order = value as Record<string, unknown>;
  if (
    order.id !== orderId ||
    order.status !== "REFUNDED" ||
    typeof order.materialId !== "string" ||
    typeof order.grossCredit !== "string" ||
    typeof order.createdAt !== "string" ||
    !Number.isInteger(order.listingVersion)
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return order as MaterialOrder;
}
