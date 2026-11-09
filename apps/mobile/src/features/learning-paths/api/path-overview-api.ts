import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
} from "@/lib/http/contracts";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  pathOverview,
  participantCase,
  participantCaseSummary,
  type PathOverviewCard,
} from "./path-overview-contract";

export function assertOverviewIdentity(row: PathOverviewCard, pathId: string) {
  if (
    row.settlement.pathId !== pathId ||
    [
      row.primaryAction.target,
      row.settlement.nextActionTarget,
      ...(row.settlement.relatedItems ?? []),
    ].some((target) => target?.type === "LEARNING_PATH" && target.id !== pathId)
  )
    throw new AppError("protocol");
}
export function createPathOverviewApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const base = (pathId: string) => resourcePath("learning-paths", pathId);
  return {
    async overview(pathId: string, signal?: AbortSignal) {
      const row = parse(
        pathOverview,
        await call(`${base(pathId)}/overview`, { signal }),
      );
      assertOverviewIdentity(row, pathId);
      return row;
    },
    async cases(pathId: string, cursor?: string, signal?: AbortSignal) {
      const page = parsePage(
        participantCase,
        await call(`${base(pathId)}/cases?${pageQuery(cursor)}`, {
          signal,
          includeMeta: true,
        }),
      );
      if (
        page.items.some((row) => row.relatedPathId !== pathId) ||
        new Set(page.items.map((row) => row.id)).size !== page.items.length
      )
        throw new AppError("protocol");
      return page;
    },
    async caseSummary(pathId: string, caseId: string, signal?: AbortSignal) {
      const suffix = resourcePath("cases", caseId);
      const row = parse(
        participantCaseSummary,
        await call(`${base(pathId)}${suffix}/summary`, { signal }),
      );
      if (
        row.id !== caseId ||
        row.relatedPathId !== pathId ||
        (row.attention &&
          (row.attention.target.type !== "CASE_SUMMARY" ||
            row.attention.target.id !== caseId ||
            row.attention.sessionId !== row.relatedSessionId))
      )
        throw new AppError("protocol");
      return row;
    },
  };
}
