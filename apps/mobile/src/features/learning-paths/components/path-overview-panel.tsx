import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
  useConnectionList,
} from "@/features/connections";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  timestamp,
  uuid,
} from "@/lib/http/contracts";
const progress = z
  .object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .nullable();
const attention = z.object({
  key: z.string(),
  type: z.string(),
  reasonCode: z.string(),
  status: z.string(),
  waitingOn: z.string(),
  sessionId: uuid.nullable(),
  deadline: timestamp.nullable(),
  blocksSettlement: z.boolean(),
  target: z.object({ type: z.string(), id: uuid }).optional(),
});
const overview = z.object({
  learningStage: z.string().nullable(),
  progress: z.object({ learning: progress, teaching: progress }),
  nextSession: z
    .object({ id: uuid, startAt: timestamp, role: z.string() })
    .nullable(),
  attentionCount: z.number(),
  attentionItems: z.array(attention),
  settlement: z.object({
    status: z.string(),
    reasonCode: z.string().nullable(),
    nextAction: z.string(),
  }),
});
const caseSchema = z.object({
  id: uuid,
  reasonCode: z.string(),
  status: z.string(),
  blocksSettlement: z.boolean(),
  relatedPathId: uuid,
  relatedSessionId: uuid.nullable(),
});
const stages: Record<string, string> = {
  PREPARING: "Đang chuẩn bị",
  WAITING_START: "Chờ bắt đầu",
  LEARNING: "Đang học",
  LEARNING_FINISHED: "Đã học xong · Chờ quyết toán",
  COMPLETED: "Đã hoàn tất",
  STOPPED: "Đã dừng",
};
const blockers: Record<string, string> = {
  WAITING_DISPUTE: "Chờ giải quyết vụ việc",
  WAITING_SESSIONS: "Còn buổi học cần hoàn thành",
  WAITING_TERMINATION: "Chờ xử lý yêu cầu dừng",
  WAITING_DISPUTE_WINDOW: "Đang trong thời hạn khiếu nại",
  NEEDS_REVIEW: "Cần nhân viên kiểm tra",
  RETRYING: "Hệ thống đang thử quyết toán lại",
};
const waiting: Record<string, string> = {
  SELF: "Cần bạn xử lý",
  COUNTERPART: "Chờ đối tác",
  STAFF: "Chờ nhân viên",
  SYSTEM: "Hệ thống đang xử lý",
  UNKNOWN: "Cần kiểm tra",
};
const statuses: Record<string, string> = {
  OPEN: "Đã tiếp nhận",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Đã từ chối",
};
export function PathOverviewPanel({ pathId }: Readonly<{ pathId: string }>) {
  const runtime = useConnections();
  const root = resourcePath("learning-paths", pathId);
  const query = useConnectionQuery(
    ["learning-paths", pathId, "overview"],
    async (signal) =>
      parse(overview, await runtime.call(root + "/overview", { signal })),
  );
  const params = useLocalSearchParams<{ cases?: string }>();
  const [expanded, setExpanded] = useState(params.cases === "1");
  useEffect(() => {
    if (params.cases === "1") setExpanded(true);
  }, [params.cases]);
  const cases = useConnectionList(
    ["learning-paths", pathId, "cases"],
    async (cursor, signal) =>
      parsePage(
        caseSchema,
        await runtime.call(`${root}/cases?${pageQuery(cursor)}`, {
          signal,
          includeMeta: true,
        }),
      ),
    expanded,
  );
  const data = query.data;
  return (
    <Panel title="Tổng quan lộ trình">
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          <Copy>
            {data.learningStage
              ? (stages[data.learningStage] ?? "Đang cập nhật")
              : "Đang cập nhật"}
          </Copy>
          {data.progress.learning && (
            <Copy>
              Học: {data.progress.learning.completed}/
              {data.progress.learning.total} buổi
            </Copy>
          )}
          {data.progress.teaching && (
            <Copy>
              Dạy: {data.progress.teaching.completed}/
              {data.progress.teaching.total} buổi
            </Copy>
          )}
          {data.nextSession && (
            <RouteButton
              secondary
              href={`/learning-sessions/${data.nextSession.id}`}
            >
              {`Buổi kế tiếp · ${new Date(data.nextSession.startAt).toLocaleString("vi-VN")}`}
            </RouteButton>
          )}
          {blockers[data.settlement.status] && (
            <Copy muted>{blockers[data.settlement.status]}</Copy>
          )}
          {data.attentionItems
            .slice(0, expanded ? undefined : 1)
            .map((item) => (
              <Panel key={item.key}>
                <Copy>
                  {waiting[item.waitingOn] ?? "Cần theo dõi"}
                  {item.blocksSettlement ? " · Đang giữ quyết toán" : ""}
                </Copy>
                {item.deadline && (
                  <Copy muted>
                    Trước {new Date(item.deadline).toLocaleString("vi-VN")}
                  </Copy>
                )}
                {item.sessionId && (
                  <RouteButton
                    secondary
                    href={`/learning-sessions/${item.sessionId}`}
                  >
                    Xem buổi học cần xử lý
                  </RouteButton>
                )}
                {!item.sessionId && item.target?.type === "LEARNING_CHANGE" && (
                  <RouteButton secondary href={`/paths/${pathId}/cancel`}>
                    Phản hồi yêu cầu dừng lộ trình
                  </RouteButton>
                )}
                {item.target?.type === "CASE_SUMMARY" && (
                  <RouteButton
                    secondary
                    href={{
                      pathname: "/reports/[id]",
                      params: { id: item.target.id, support: "1", pathId },
                    }}
                  >
                    Theo dõi vụ việc
                  </RouteButton>
                )}
              </Panel>
            ))}
          <Button variant="paper" onPress={() => setExpanded(!expanded)}>
            {expanded
              ? "Thu gọn"
              : `Việc cần xử lý & vụ việc${data.attentionCount ? ` (${data.attentionCount})` : ""}`}
          </Button>
        </>
      )}
      {expanded && (
        <>
          <ConnectionFeedback
            loading={cases.isLoading}
            error={cases.error}
            retry={cases.refetch}
          />
          {cases.items.map((item) => (
            <CaseSummary
              key={item.id}
              pathId={pathId}
              caseId={item.id}
              status={statuses[item.status] ?? "Đang cập nhật"}
            />
          ))}
          {cases.data && !cases.items.length && (
            <Copy muted>Không có vụ việc liên quan.</Copy>
          )}
          {cases.hasNextPage && (
            <Button
              variant="paper"
              disabled={cases.isFetching}
              onPress={() => void cases.fetchNextPage()}
            >
              Xem thêm vụ việc
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
function CaseSummary({
  pathId,
  caseId,
  status,
}: Readonly<{ pathId: string; caseId: string; status: string }>) {
  const runtime = useConnections();
  const [open, setOpen] = useState(false);
  const query = useConnectionQuery(
    ["learning-paths", pathId, "cases", caseId],
    async (signal) =>
      parse(
        caseSchema,
        await runtime.call(
          `${resourcePath("learning-paths", pathId)}/cases/${encodeURIComponent(caseId)}/summary`,
          { signal },
        ),
      ),
    open,
  );
  return (
    <Panel>
      <Button variant="paper" onPress={() => setOpen(!open)}>
        Vụ việc · {status}
      </Button>
      {open && (
        <>
          <ConnectionFeedback
            error={query.error}
            loading={query.isLoading}
            retry={query.refetch}
          />
          {query.data && (
            <>
              <Copy>
                {query.data.blocksSettlement
                  ? "Đang giữ quyết toán"
                  : "Không giữ quyết toán"}
              </Copy>
              <RouteButton
                secondary
                href={{
                  pathname: "/reports/[id]",
                  params: { id: caseId, support: "1", pathId },
                }}
              >
                Trao đổi với người xử lý
              </RouteButton>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
