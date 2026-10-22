import type { PaginatedHttpClient } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parseHistoryFilters,
  parseTransaction,
  validTransactionId,
} from "../schemas/transaction-contracts";
import type { HistoryFilters, TransactionPage } from "../types/transaction";

export type TransactionClient = Pick<
  PaginatedHttpClient,
  "request" | "requestPage"
>;
export function createTransactionApi(client: TransactionClient) {
  return {
    list: async (
      filters: HistoryFilters,
      cursor: string | undefined,
      signal: AbortSignal,
    ): Promise<TransactionPage> => {
      const selection = parseHistoryFilters(filters),
        query = new URLSearchParams({ limit: "20" });
      if (selection.type) query.set("type", selection.type);
      if (selection.referenceType)
        query.set("referenceType", selection.referenceType);
      if (cursor !== undefined) {
        if (!cursor || cursor.length > 1024) throw new AppError("protocol");
        query.set("cursor", cursor);
      }
      const page = await client.requestPage(
        `/me/wallet/transactions?${query}`,
        { method: "GET", authenticated: true, signal },
      );
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
        data: page.data.map(parseTransaction),
        pagination: page.pagination,
      };
    },
    detail: async (id: string, signal: AbortSignal) => {
      if (!validTransactionId(id)) throw new AppError("protocol");
      const row = parseTransaction(
        await client.request(
          `/me/wallet/transactions/${encodeURIComponent(id)}`,
          { method: "GET", authenticated: true, signal },
        ),
      );
      if (row.id.toLowerCase() !== id.toLowerCase())
        throw new AppError("protocol");
      return row;
    },
  };
}
