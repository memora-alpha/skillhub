import { systemCodeLabel } from "@/constants/system-text";
import { useMemo } from "react";
import { Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { DataForm, textRule } from "@/components/data-form";
import {
  useConnections,
  useConnectionQuery,
  useConnectionCommand,
  ConnectionFeedback,
} from "@/features/connections";
import { createPostLearningApi } from "../api/post-learning-api";
import type { LearningChange } from "../api/post-learning-contracts";

const labels: Record<string, string> = {
  PENDING: "Chờ đối tác",
  ACCEPTED: "Hai bên đã đồng ý, chờ xử lý",
  STAFF_REVIEW: "Đang chuyển nhân sự",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
  APPLIED: "Đã áp dụng",
};
export function LearningChangePanel({
  pathId,
  sessionId,
  startAt,
  canRequest,
  blocked = false,
  onChanged,
}: Readonly<{
  pathId: string;
  sessionId?: string;
  startAt?: string;
  canRequest: boolean;
  blocked?: boolean;
  onChanged?: () => unknown;
}>) {
  const runtime = useConnections();
  const api = useMemo(() => createPostLearningApi(runtime.call), [runtime]);
  const query = useConnectionQuery(
    ["learning-paths", pathId, "changes", sessionId ?? "path"],
    (signal) => api.changes(pathId, sessionId, signal),
  );
  const creation = useConnectionCommand<LearningChange>([["learning-paths"]]);
  const decision = useConnectionCommand<LearningChange>([["learning-paths"]]);
  const disabled =
    blocked ||
    query.isFetching ||
    !!query.error ||
    creation.pending ||
    creation.uncertain ||
    decision.pending ||
    decision.uncertain;
  const open = query.data?.some((row) =>
    ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(row.status),
  );
  async function act(
    row: LearningChange,
    action: "withdraw" | "response",
    accept?: boolean,
  ) {
    await decision.run(
      JSON.stringify({ id: row.id, action, accept, version: row.version }),
      () =>
        api.respond(
          pathId,
          sessionId,
          row.id,
          row.version,
          action,
          action === "response" ? { accept } : {},
        ),
    );
    if (runtime.isCurrent()) {
      void query.refetch();
      onChanged?.();
    }
  }
  return (
    <Panel title={sessionId ? "Hủy buổi để học bù" : "Dừng lộ trình"}>
      <Copy>
        {sessionId
          ? "Hai bên cần đồng ý trước giờ bắt đầu. Giữ nguyên số buổi và Credit; người yêu cầu dùng một lượt học bù, người chấp nhận không mất lượt. Lịch bù cần được hai bên chốt lại."
          : "Gửi yêu cầu không tự hủy lịch học. Việc dừng và xử lý Credit cần quyết định theo chính sách đã duyệt; không tự tính hoàn theo số buổi."}
      </Copy>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {!open && canRequest && (
        <DataForm
          fields={[
            {
              name: "reason",
              label: "Lý do yêu cầu",
              rule: textRule(3, 1000),
              multiline: true,
            },
          ]}
          submitLabel="Gửi yêu cầu cho đối tác"
          disabled={disabled || !query.data}
          onSubmit={async (values) => {
            const body = {
              reason: values.reason!,
              ...(sessionId ? { expectedStartAt: startAt } : {}),
            };
            await creation.run(
              JSON.stringify({ pathId, sessionId, body }),
              (key) => api.requestChange(pathId, sessionId, key, body),
            );
            if (runtime.isCurrent()) {
              void query.refetch();
              onChanged?.();
            }
          }}
        />
      )}
      <ConnectionFeedback error={creation.error} />
      <ConnectionFeedback error={decision.error} />
      {creation.uncertain && (
        <>
          <Copy>
            Kết quả gửi chưa rõ. Chỉ kiểm tra lại cùng yêu cầu, không tạo một
            yêu cầu khác.
          </Copy>
          <Button
            disabled={creation.pending}
            onPress={() =>
              void creation.retry().then(() => {
                void query.refetch();
                onChanged?.();
              })
            }
          >
            Kiểm tra lại cùng yêu cầu
          </Button>
        </>
      )}
      {decision.uncertain && (
        <Copy>
          Kết quả phản hồi chưa rõ. Tải lại lịch sử để kiểm tra; không tự gửi
          lại thao tác.
        </Copy>
      )}
      {query.data?.map((row) => (
        <Panel
          key={row.id}
          title={labels[row.status] ?? systemCodeLabel(row.status)}
        >
          <Copy>{row.reason}</Copy>
          <Copy muted>
            Hạn phản hồi: {new Date(row.expiresAt).toLocaleString("vi-VN")}
          </Copy>
          {row.responseNote && <Copy>Phản hồi: {row.responseNote}</Copy>}
          {row.blockedByDispute && (
            <Copy>Đang có tranh chấp, chưa thể áp dụng quyết định.</Copy>
          )}
          {row.awaitingPolicy && (
            <Copy>Chờ chính sách xử lý Credit được duyệt.</Copy>
          )}
          {row.status === "PENDING" &&
            (row.requesterId === runtime.userId ? (
              <Button
                variant="paper"
                disabled={disabled}
                onPress={() => void act(row, "withdraw")}
              >
                Rút yêu cầu
              </Button>
            ) : (
              <>
                <Button
                  disabled={disabled}
                  onPress={() => void act(row, "response", true)}
                >
                  Đồng ý yêu cầu
                </Button>
                <Button
                  variant="paper"
                  disabled={disabled}
                  onPress={() => void act(row, "response", false)}
                >
                  Từ chối
                </Button>
              </>
            ))}
          {["ACCEPTED", "STAFF_REVIEW"].includes(row.status) &&
            row.requesterId === runtime.userId && (
              <Button
                variant="paper"
                disabled={disabled}
                onPress={() => void act(row, "withdraw")}
              >
                Rút yêu cầu chưa thực thi
              </Button>
            )}
          {!sessionId && ["PENDING", "ACCEPTED"].includes(row.status) && (
            <DataForm
              fields={[
                {
                  name: "reason",
                  label: "Lý do cần nhân sự hỗ trợ",
                  rule: textRule(3, 1000),
                  multiline: true,
                },
              ]}
              submitLabel="Chuyển nhân sự xem xét"
              disabled={disabled}
              onSubmit={async (values) => {
                await decision.run(
                  JSON.stringify({
                    id: row.id,
                    version: row.version,
                    reason: values.reason,
                  }),
                  () =>
                    api.respond(
                      pathId,
                      undefined,
                      row.id,
                      row.version,
                      "escalate",
                      { reason: values.reason },
                    ),
                );
                void query.refetch();
                onChanged?.();
              }}
            />
          )}
        </Panel>
      ))}
      <Button
        variant="paper"
        disabled={query.isFetching || creation.pending || decision.pending}
        onPress={() => void query.refetch()}
      >
        Tải lại lịch sử yêu cầu
      </Button>
    </Panel>
  );
}
