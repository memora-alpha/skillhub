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
import { LearningChangeRequest } from "./learning-change-request";

function CompactChangePanel({
  title,
  children,
}: Readonly<{
  title: string;
  children: ReactNode;
}>) {
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

function ChangePanelFrame({
  compact,
  embedded,
  title,
  children,
}: Readonly<{
  compact: boolean;
  embedded: boolean;
  title: string;
  children: ReactNode;
}>) {
  if (compact && embedded)
    return <View style={styles.embedded}>{children}</View>;
  if (compact)
    return <CompactChangePanel title={title}>{children}</CompactChangePanel>;
  return <Panel title={title}>{children}</Panel>;
}

function changePanelTitle(compact: boolean, sessionId?: string) {
  if (compact) return "Thay đổi buổi học";
  if (sessionId) return "Hủy buổi để học bù";
  return "Dừng lộ trình";
}

function changeGuidance(compact: boolean, sessionId?: string) {
  if (!sessionId)
    return "Gửi yêu cầu không tự hủy lịch học. Việc dừng và xử lý Credit cần quyết định theo chính sách đã duyệt; không tự tính hoàn theo số buổi.";
  if (compact)
    return "Cần hai bên đồng ý trước giờ học. Người yêu cầu dùng 1 lượt học bù; số buổi và Credit giữ nguyên. Hai bên cần chốt lại lịch bù.";
  return "Hai bên cần đồng ý trước giờ bắt đầu. Giữ nguyên số buổi và Credit; người yêu cầu dùng một lượt học bù, người chấp nhận không mất lượt. Lịch bù cần được hai bên chốt lại.";
}

function RequestToggle({
  embedded,
  open,
  onToggle,
}: Readonly<{ embedded: boolean; open: boolean; onToggle: () => void }>) {
  const label = open ? "Đóng yêu cầu" : "Yêu cầu hủy để học bù";
  const content = embedded ? (
    <Text style={styles.toggleLabel}>{label}</Text>
  ) : (
    label
  );
  return (
    <Button
      variant={embedded ? "ghost" : "paper"}
      style={embedded ? styles.requestToggle : undefined}
      leadingIcon={embedded ? "calendar" : undefined}
      icon={embedded ? "chevron" : undefined}
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
    >
      {content}
    </Button>
  );
}

function isActive(row: LearningChange) {
  return ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(row.status);
}

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
  const open = query.data?.some(isActive);
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
  async function escalate(row: LearningChange, reason: string) {
    await decision.run(
      JSON.stringify({ id: row.id, version: row.version, reason }),
      () =>
        api.respond(pathId, undefined, row.id, row.version, "escalate", {
          reason,
        }),
    );
    void query.refetch();
    onChanged?.();
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
  return (
    <ChangePanelFrame
      compact={compactSession}
      embedded={embedded}
      title={changePanelTitle(compactSession, sessionId)}
    >
      {(!compactSession || requestOpen || open) && (
        <Copy size={compactSession ? "hint" : "body"}>
          {changeGuidance(compactSession, sessionId)}
        </Copy>
      )}
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {!open && canRequest && (
        <>
          {compactSession && (
            <RequestToggle
              embedded={embedded}
              open={requestOpen}
              onToggle={() => setRequestOpen(!requestOpen)}
            />
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
        <LearningChangeRequest
          key={row.id}
          row={row}
          compact={compactSession}
          userId={runtime.userId}
          sessionId={sessionId}
          disabled={disabled}
          onAct={act}
          onEscalate={escalate}
        />
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
    </ChangePanelFrame>
  );
}
