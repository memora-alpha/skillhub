import { Text, View } from "react-native";
import type { ReactNode } from "react";
import { systemCodeLabel } from "@/constants/system-text";
import { Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { DataForm, textRule } from "@/components/data-form";
import type { LearningChange } from "../api/post-learning-contracts";
import { changePanelStyles as styles } from "./learning-change-panel.styles";

const labels: Record<string, string> = {
  PENDING: "Chờ đối tác",
  ACCEPTED: "Hai bên đã đồng ý, chờ xử lý",
  STAFF_REVIEW: "Đang chuyển nhân sự",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
  APPLIED: "Đã áp dụng",
};

function CompactRequest({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <View style={styles.request}>
      <Text accessibilityRole="header" style={styles.status}>
        {title}
      </Text>
      {children}
    </View>
  );
}

type Props = Readonly<{
  row: LearningChange;
  compact: boolean;
  userId?: string;
  sessionId?: string;
  disabled: boolean;
  onAct: (
    row: LearningChange,
    action: "withdraw" | "response",
    accept?: boolean,
  ) => Promise<void>;
  onEscalate: (row: LearningChange, reason: string) => Promise<void>;
}>;

function PendingActions({
  row,
  userId,
  disabled,
  onAct,
}: Pick<Props, "row" | "userId" | "disabled" | "onAct">) {
  if (row.status !== "PENDING") return null;
  if (row.requesterId === userId)
    return (
      <Button
        variant="paper"
        disabled={disabled}
        onPress={() => void onAct(row, "withdraw")}
      >
        Rút yêu cầu
      </Button>
    );
  return (
    <>
      <Button
        disabled={disabled}
        onPress={() => void onAct(row, "response", true)}
      >
        Đồng ý yêu cầu
      </Button>
      <Button
        variant="paper"
        disabled={disabled}
        onPress={() => void onAct(row, "response", false)}
      >
        Từ chối
      </Button>
    </>
  );
}

export function LearningChangeRequest({
  row,
  compact,
  userId,
  sessionId,
  disabled,
  onAct,
  onEscalate,
}: Props) {
  const RequestCard = compact ? CompactRequest : Panel;
  const needsResponse =
    compact && row.status === "PENDING" && row.requesterId !== userId;
  const title = needsResponse
    ? "Cần bạn phản hồi"
    : (labels[row.status] ?? systemCodeLabel(row.status));
  return (
    <RequestCard title={title}>
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
      <PendingActions
        row={row}
        userId={userId}
        disabled={disabled}
        onAct={onAct}
      />
      {["ACCEPTED", "STAFF_REVIEW"].includes(row.status) &&
        row.requesterId === userId && (
          <Button
            variant="paper"
            disabled={disabled}
            onPress={() => void onAct(row, "withdraw")}
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
          onSubmit={(values) => onEscalate(row, values.reason!)}
        />
      )}
    </RequestCard>
  );
}
