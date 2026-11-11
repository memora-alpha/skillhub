import { systemCodeLabel } from "@/constants/system-text";
import { useMemo, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
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
import { changePanelStyles as styles } from "./learning-change-panel.styles";

function CompactChangePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Icon name="calendar" size={18} color={colors.forest} />
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function CompactRequest({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.request}>
      <Text accessibilityRole="header" style={styles.status}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function EmbeddedChangePanel({
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return <View style={styles.embedded}>{children}</View>;
}

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
  compact = false,
  embedded = false,
  onChanged,
}: Readonly<{
  pathId: string;
  sessionId?: string;
  startAt?: string;
  canRequest: boolean;
  blocked?: boolean;
  compact?: boolean;
  embedded?: boolean;
  onChanged?: () => unknown;
}>) {
  const runtime = useConnections();
  const [requestOpen, setRequestOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const compactSession = compact && !!sessionId;
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
  const isActive = (row: LearningChange) =>
    ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(row.status);
  const history = query.data?.filter((row) => !isActive(row)) ?? [];
  const rows = compactSession
    ? [...(query.data?.filter(isActive) ?? []), ...(historyOpen ? history : [])]
    : query.data;
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
  if (
    compactSession &&
    !canRequest &&
    query.data?.length === 0 &&
    !creation.pending &&
    !decision.pending &&
    !query.error &&
    !creation.error &&
    !decision.error &&
    !creation.uncertain &&
    !decision.uncertain
  )
    return null;
  const Container = compactSession
    ? embedded
      ? EmbeddedChangePanel
      : CompactChangePanel
    : Panel;
  const RequestCard = compactSession ? CompactRequest : Panel;
  return (
    <Container
      title={
        compactSession
          ? "Thay đổi buổi học"
          : sessionId
            ? "Hủy buổi để học bù"
            : "Dừng lộ trình"
      }
    >
      {(!compactSession || requestOpen || open) && (
        <Copy size={compactSession ? "hint" : "body"}>
          {sessionId
            ? compactSession
              ? "Cần hai bên đồng ý trước giờ học. Người yêu cầu dùng 1 lượt học bù; số buổi và Credit giữ nguyên. Hai bên cần chốt lại lịch bù."
              : "Hai bên cần đồng ý trước giờ bắt đầu. Giữ nguyên số buổi và Credit; người yêu cầu dùng một lượt học bù, người chấp nhận không mất lượt. Lịch bù cần được hai bên chốt lại."
            : "Gửi yêu cầu không tự hủy lịch học. Việc dừng và xử lý Credit cần quyết định theo chính sách đã duyệt; không tự tính hoàn theo số buổi."}
        </Copy>
      )}
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {!open && canRequest && (
        <>
          {compactSession && (
            <Button
              variant={embedded ? "ghost" : "paper"}
              style={embedded ? styles.requestToggle : undefined}
              leadingIcon={embedded ? "calendar" : undefined}
              icon={embedded ? "chevron" : undefined}
              accessibilityLabel={
                requestOpen ? "Đóng yêu cầu" : "Yêu cầu hủy để học bù"
              }
              accessibilityState={{ expanded: requestOpen }}
              onPress={() => setRequestOpen(!requestOpen)}
            >
              {embedded ? (
                <Text style={styles.toggleLabel}>
                  {requestOpen ? "Đóng yêu cầu" : "Yêu cầu hủy để học bù"}
                </Text>
              ) : requestOpen ? (
                "Đóng yêu cầu"
              ) : (
                "Yêu cầu hủy để học bù"
              )}
            </Button>
          )}
          <View
            style={
              compactSession && !requestOpen ? { display: "none" } : undefined
            }
          >
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
          </View>
        </>
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
      {rows?.map((row) => (
        <RequestCard
          key={row.id}
          title={
            compactSession &&
            row.status === "PENDING" &&
            row.requesterId !== runtime.userId
              ? "Cần bạn phản hồi"
              : (labels[row.status] ?? systemCodeLabel(row.status))
          }
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
        </RequestCard>
      ))}
      {compactSession && history.length > 0 && (
        <Button
          variant="ghost"
          accessibilityState={{ expanded: historyOpen }}
          onPress={() => setHistoryOpen(!historyOpen)}
        >
          {historyOpen
            ? "Ẩn lịch sử yêu cầu"
            : `Lịch sử yêu cầu (${history.length})`}
        </Button>
      )}
      {(!compactSession || !!query.error || historyOpen) && (
        <Button
          variant="paper"
          disabled={query.isFetching || creation.pending || decision.pending}
          onPress={() => void query.refetch()}
        >
          Tải lại lịch sử yêu cầu
        </Button>
      )}
    </Container>
  );
}
