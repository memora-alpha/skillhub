import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { parse, resourcePath, uuid, version } from "@/lib/http/contracts";
import { terminationQuote } from "./termination-quote-contract";
import {
  changeReason,
  settlementStatus,
  settlementConsentReceipt,
  terminationRequest,
} from "./path-changes-contract";

export function createPathChangesApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const base = (pathId: string) =>
    `${resourcePath("learning-paths", pathId)}/termination-requests`;
  function readRequest(data: unknown, pathId: string, requestId?: string) {
    const row = parse(terminationRequest, data);
    if (row.pathId !== pathId || (requestId && row.id !== requestId))
      throw new AppError("protocol");
    return row;
  }
  async function command(
    pathId: string,
    requestId: string,
    action: string,
    body: unknown,
  ) {
    parse(uuid, requestId);
    return readRequest(
      await call(`${base(pathId)}/${requestId}/${action}`, {
        method: "POST",
        body,
        replayAfterRenewal: false,
      }),
      pathId,
      requestId,
    );
  }
  return {
    async quote(pathId: string, signal?: AbortSignal) {
      const result = parse(
        terminationQuote,
        await call(`${base(pathId)}/quote`, { signal }),
      );
      if (
        result.pathId !== pathId ||
        new Set(result.allocations.map((row) => row.allocationId)).size !==
          result.allocations.length ||
        new Set(result.allocations.map((row) => row.userId)).size !==
          result.allocations.length
      )
        throw new AppError("protocol");
      return result;
    },
    async list(pathId: string, signal?: AbortSignal) {
      const rows = parse(
        z.array(terminationRequest).max(100),
        await call(base(pathId), { signal }),
      );
      if (
        rows.some((row) => row.pathId !== pathId) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw new AppError("protocol");
      return rows;
    },
    async settlement(pathId: string, signal?: AbortSignal) {
      const result = parse(
        settlementStatus,
        await call(
          `${resourcePath("learning-paths", pathId)}/settlement-status`,
          { signal },
        ),
      );
      if (result.pathId !== pathId) throw new AppError("protocol");
      return result;
    },
    async request(pathId: string, reason: string, idempotencyKey: string) {
      const body = { reason: parse(changeReason, reason) };
      parse(z.string().regex(/^[\x21-\x7e]{1,128}$/), idempotencyKey);
      return readRequest(
        await call(base(pathId), {
          method: "POST",
          body,
          idempotencyKey,
          replayAfterRenewal: false,
        }),
        pathId,
      );
    },
    async approveSettlement(pathId: string, expectedVersion: number) {
      const body = { expectedVersion: parse(version, expectedVersion) };
      const result = parse(
        settlementConsentReceipt,
        await call(
          `${resourcePath("sessions/paths", pathId)}/settlement-consent`,
          { method: "POST", body, replayAfterRenewal: false },
        ),
      );
      if (result.pathId !== pathId) throw new AppError("protocol");
      return result;
    },
    respond(
      pathId: string,
      requestId: string,
      expectedVersion: number,
      accept: boolean,
      note: string,
    ) {
      return command(pathId, requestId, "response", {
        expectedVersion: parse(version, expectedVersion),
        accept,
        ...(note.trim()
          ? { note: parse(z.string().trim().max(1000), note) }
          : {}),
      });
    },
    withdraw(pathId: string, requestId: string, expectedVersion: number) {
      return command(pathId, requestId, "withdraw", {
        expectedVersion: parse(version, expectedVersion),
      });
    },
    escalate(
      pathId: string,
      requestId: string,
      expectedVersion: number,
      reason: string,
    ) {
      return command(pathId, requestId, "escalate", {
        expectedVersion: parse(version, expectedVersion),
        reason: parse(changeReason, reason),
      });
    },
  };
}
