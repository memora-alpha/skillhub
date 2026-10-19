import { z } from "zod";
import { parse } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import type { createProposalsApi, Proposal } from "./proposals-api";

const cursorSchema = z
  .object({
    status: z
      .enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"])
      .nullable(),
    received: z.string().min(1).nullable(),
    sent: z.string().min(1).nullable(),
  })
  .strict();

// "all" is a mobile view. BE still receives its two supported directions,
// each with its own cursor; an exhausted direction must never restart.
export async function listAllProposals(
  api: Pick<ReturnType<typeof createProposalsApi>, "list">,
  status?: Proposal["status"],
  cursor?: string,
  signal?: AbortSignal,
) {
  let previous: z.infer<typeof cursorSchema> | undefined;
  if (cursor) {
    try {
      previous = parse(cursorSchema, JSON.parse(cursor));
    } catch {
      throw new AppError("protocol");
    }
    if (previous.status !== (status ?? null)) throw new AppError("protocol");
  }
  const directions = ["received", "sent"] as const;
  const pages = await Promise.all(
    directions.map(async (direction) => {
      const next = previous?.[direction];
      if (next === null) return { items: [], nextCursor: null };
      const page = await api.list(direction, status, next, signal);
      if (next && next === page.nextCursor) throw new AppError("protocol");
      return page;
    }),
  );
  const received = pages[0]!.nextCursor;
  const sent = pages[1]!.nextCursor;
  return {
    items: [
      ...new Map(
        pages.flatMap((page) => page.items).map((item) => [item.id, item]),
      ).values(),
    ],
    nextCursor:
      received || sent
        ? JSON.stringify({ status: status ?? null, received, sent })
        : null,
  };
}
