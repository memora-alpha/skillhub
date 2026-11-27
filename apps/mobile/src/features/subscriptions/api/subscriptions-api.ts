import { z } from "zod";
import { parse, parsePage, pageQuery } from "@/lib/http/contracts";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  planSchema,
  membershipSchema,
  quoteSchema,
  planCodeSchema,
  updateSchema,
  intentSchema,
  chargeSchema,
  type PlanCode,
  type SubscriptionIntent,
  type SubscriptionUpdate,
} from "./subscription-contracts";

export function createSubscriptionsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async plans(signal?: AbortSignal) {
      const rows = parse(
        z.array(planSchema),
        await call("/subscriptions/plans", { signal }),
      );
      if (new Set(rows.map((row) => row.planCode)).size !== rows.length)
        throw new AppError("protocol");
      return rows;
    },
    async me(signal?: AbortSignal) {
      return parse(
        membershipSchema,
        await call("/me/subscription", { signal }),
      );
    },
    async quote(planCode: PlanCode, signal?: AbortSignal) {
      const code = parse(planCodeSchema, planCode);
      const row = parse(
        quoteSchema,
        await call(`/me/subscription/upgrade-quote?planCode=${code}`, {
          signal,
        }),
      );
      if (row.planCode !== code) throw new AppError("protocol");
      return row;
    },
    async send(input: SubscriptionIntent) {
      const { key, command } = parse(intentSchema, input);
      return parse(
        membershipSchema,
        await call(
          command.kind === "purchase"
            ? "/me/subscription"
            : "/me/subscription/upgrade",
          {
            method: "POST",
            body: command.body,
            idempotencyKey: key,
            replayAfterRenewal: false,
          },
        ),
      );
    },
    async update(input: SubscriptionUpdate) {
      return parse(
        membershipSchema,
        await call("/me/subscription", {
          method: "PATCH",
          body: parse(updateSchema, input),
          replayAfterRenewal: false,
        }),
      );
    },
    async charges(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        chargeSchema,
        await call(`/me/subscription/charges?${pageQuery(cursor)}`, {
          signal,
          includeMeta: true,
        }),
      );
    },
  };
}
