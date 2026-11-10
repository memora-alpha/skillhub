import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Copy, Panel } from "@/components/feature-page";
import { parse, uuid, timestamp, pageQuery } from "@/lib/http/contracts";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionList,
} from "@/features/connections";
const person = z.object({ userId: uuid, displayName: z.string() }).nullable();
const page = z.object({
  data: z.object({
    items: z.array(
      z.object({
        id: uuid,
        rating: z.number().int().min(1).max(5),
        comment: z.string().nullable(),
        createdAt: timestamp,
        reviewer: person,
        reviewee: person.optional(),
      }),
    ),
    summary: z.object({
      reviewCount: z.number(),
      averageRating: z.number().nullable(),
      ratingDistribution: z.record(z.string(), z.number()),
    }),
  }),
  meta: z.object({
    pagination: z.object({ nextCursor: z.string().nullable() }),
  }),
});
export function ProfileReviews({
  userId,
  own = false,
}: Readonly<{ userId: string; own?: boolean }>) {
  const runtime = useConnections();
  const [direction, setDirection] = useState<"received" | "sent">("received");
  const query = useConnectionList(
    ["profile-reviews", userId, direction],
    async (cursor, signal) => {
      const query = pageQuery(cursor);
      if (own) query.set("direction", direction);
      const endpoint = own
        ? "/me/reviews"
        : `/profiles/${encodeURIComponent(userId)}/reviews`;
      const result = parse(
        page,
        await runtime.call(`${endpoint}?${query}`, {
          signal,
          includeMeta: true,
        }),
      );
      return {
        items: result.data.items,
        nextCursor: result.meta.pagination.nextCursor,
        summary: result.data.summary,
      };
    },
    uuid.safeParse(userId).success,
  );
  const summaryResult = z
    .object({ summary: page.shape.data.shape.summary })
    .safeParse(query.data?.pages[0]);
  const summary = summaryResult.success
    ? summaryResult.data.summary
    : undefined;
  const [expanded, setExpanded] = useState(false);
  return (
    <Panel title="Đánh giá">
      {summary && (
        <>
          <Copy>
            {summary.averageRating === null
              ? "Chưa có đánh giá"
              : `${summary.averageRating}/5 · ${summary.reviewCount} đánh giá`}
          </Copy>
          <Button variant="paper" onPress={() => setExpanded(!expanded)}>
            {expanded ? "Thu gọn" : "Xem đánh giá"}
          </Button>
        </>
      )}
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {expanded && (
        <>
          {own && (
            <Button
              variant="paper"
              onPress={() =>
                setDirection(direction === "sent" ? "received" : "sent")
              }
            >
              {direction === "received"
                ? "Đang xem: Đã nhận · Chuyển sang đã gửi"
                : "Đang xem: Đã gửi · Chuyển sang đã nhận"}
            </Button>
          )}
          {summary && (
            <Copy muted>
              {[5, 4, 3, 2, 1]
                .map(
                  (star) =>
                    `${star}★: ${summary.ratingDistribution[String(star)] ?? 0}`,
                )
                .join(" · ")}
            </Copy>
          )}
          {!query.items.length && <Copy muted>Chưa có đánh giá.</Copy>}
          {query.items.map((row) => (
            <Panel
              key={row.id}
              title={`${row.rating}★ · ${(direction === "sent" ? row.reviewee : row.reviewer)?.displayName ?? "Thành viên"}`}
            >
              <Copy>{row.comment || "Không có nhận xét."}</Copy>
              <Copy muted>
                {new Date(row.createdAt).toLocaleDateString("vi-VN")}
              </Copy>
            </Panel>
          ))}
          {query.hasNextPage && (
            <Button
              variant="paper"
              disabled={query.isFetching}
              onPress={() => void query.fetchNextPage()}
            >
              Xem thêm
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
