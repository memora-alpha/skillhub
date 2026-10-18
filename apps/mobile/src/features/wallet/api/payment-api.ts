import type { HttpClient, PaginatedHttpClient } from "@/lib/http/client";
import { z } from "zod";
import type { Page } from "@/lib/http/response";
import type { PaymentProjection } from "../types/payment";
import { AppError } from "@/lib/http/errors";
import { parsePayment, validPaymentId } from "../schemas/payment-contracts";

export type PaymentFilters = {
  status?:
    | "CREATED"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "REFUNDED"
    | "REVIEW";
};
const filterSchema = z
  .object({
    status: z
      .enum([
        "CREATED",
        "PENDING",
        "PAID",
        "FAILED",
        "EXPIRED",
        "REFUNDED",
        "REVIEW",
      ])
      .optional(),
  })
  .strict();
export type PaymentClient = Pick<HttpClient, "request"> &
  Partial<Pick<PaginatedHttpClient, "requestPage">>;
export function createPaymentApi(client: PaymentClient) {
  return {
    list: async (
      filters: PaymentFilters,
      cursor: string | undefined,
      signal: AbortSignal,
    ): Promise<Page<PaymentProjection>> => {
      const parsed = filterSchema.safeParse(filters);
      if (!parsed.success) throw new AppError("protocol");
      if (!client.requestPage) throw new AppError("config");
      const query = new URLSearchParams({ limit: "20" });
      if (parsed.data.status) query.set("status", parsed.data.status);
      if (cursor !== undefined) {
        if (!cursor || cursor.length > 1024) throw new AppError("protocol");
        query.set("cursor", cursor);
      }
      const page = await client.requestPage(`/payments?${query}`, {
        method: "GET",
        authenticated: true,
        signal,
      });
      if (
        page.pagination.limit !== 20 ||
        page.data.length > 20 ||
        (page.pagination.hasMore &&
          (!page.data.length ||
            !page.pagination.nextCursor ||
            page.pagination.nextCursor === cursor)) ||
        (!page.pagination.hasMore && page.pagination.nextCursor !== null)
      )
        throw new AppError("protocol");
      return {
        data: page.data.map((value) => parsePayment(value)),
        pagination: page.pagination,
      };
    },
    detail: async (id: string, signal: AbortSignal) => {
      if (!validPaymentId(id)) throw new AppError("protocol");
      return parsePayment(
        await client.request(`/payments/${encodeURIComponent(id)}`, {
          method: "GET",
          authenticated: true,
          signal,
        }),
        id,
      );
    },
  };
}
