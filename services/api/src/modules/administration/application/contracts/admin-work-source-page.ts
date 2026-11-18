import { Prisma } from "../../../../generated/prisma/client";
import type { WorkCursor } from "../../domain/admin-work-item-cursor";

/** Exported query contract; each owning module supplies its own projection. */
export type AdminWorkSourcePage = {
  cursor?: Pick<WorkCursor, "receivedAt" | "kind" | "id">;
  order: "asc" | "desc";
  take: number;
  filters?: {
    severity?: string;
    waitingOn?: string;
    assignee?: string;
    waitingBefore?: Date;
    q?: string;
  };
};

/** Projections expose id, receivedAt, title, reason, severity and assignee. */
export function adminWorkSourceQuery(
  projection: Prisma.Sql,
  kind: string,
  page: AdminWorkSourcePage,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const filters = page.filters;
  if (filters?.severity)
    conditions.push(Prisma.sql`source."severity" = ${filters.severity}`);
  if (filters?.waitingOn)
    conditions.push(Prisma.sql`CASE WHEN source."assignee" IS NULL THEN 'ADMIN'
      ELSE 'ASSIGNEE' END = ${filters.waitingOn}`);
  if (filters?.assignee)
    conditions.push(Prisma.sql`source."assignee"::text = ${filters.assignee}`);
  if (filters?.waitingBefore)
    conditions.push(
      Prisma.sql`source."receivedAt" <= ${filters.waitingBefore}`,
    );
  if (filters?.q?.trim())
    conditions.push(Prisma.sql`strpos(lower(
      ${kind}::text || '-' || upper(left(source."id"::text, 8)) || ' ' ||
      source."title" || ' ' || coalesce(source."reason", '')
    ), ${filters.q.trim().toLowerCase()}) > 0`);
  const cursor = page.cursor;
  if (cursor) {
    const timeComparison =
      page.order === "desc" ? Prisma.sql`<` : Prisma.sql`>`;
    conditions.push(Prisma.sql`(
      source."receivedAt" ${timeComparison} ${cursor.receivedAt}
      OR (source."receivedAt" = ${cursor.receivedAt} AND
        (${kind}::text COLLATE "C", source."id"::text COLLATE "C") >
        (${cursor.kind}::text COLLATE "C", ${cursor.id}::text COLLATE "C"))
    )`);
  }
  const order = page.order === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  return Prisma.sql`SELECT source.* FROM (${projection}) AS source
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY source."receivedAt" ${order}, source."id"::text COLLATE "C" ASC
    LIMIT ${page.take}`;
}
