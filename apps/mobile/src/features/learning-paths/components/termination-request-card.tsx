import { useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { cancellationStyles as ui } from "./cancellation-styles";
import { TerminationStatusHeader } from "./termination-status-header";
import { useConnectionCommand, useConnections } from "@/features/connections";
import {
  changeReason,
  type TerminationRequest,
} from "../api/path-changes-contract";
import { usePathChangesApi } from "../hooks/use-path-changes";
import {
  terminationActions,
  openTermination,
} from "../utils/termination-policy";
import { TerminationDecision } from "./termination-decision";
import { TerminationRequestMetadata } from "./termination-request-metadata";
import { TerminationFeedback } from "./termination-feedback";
import {
  TerminationActionDialog,
  type TerminationAction,
} from "./termination-action-dialog";

const actionLabels: Record<TerminationAction, string> = {
  accept: "Đồng ý hủy",
  decline: "Không đồng ý",
  withdraw: "Rút yêu cầu",
  escalate: "Nhờ hỗ trợ",
};
function cancellationStatusNotice(
  request: TerminationRequest,
  userId?: string,
) {
  if (request.approvedAt) return "Đã duyệt hủy.";
  if (request.status === "STAFF_REVIEW")
    return "Yêu cầu hủy đang chờ nhân viên xem xét.";
  if (request.status === "ACCEPTED")
    return "Yêu cầu hủy đã được đồng ý, đang chờ cập nhật kết quả.";
  if (request.requesterId === userId)
    return "Đã gửi yêu cầu hủy, đang chờ đối tác đồng ý.";
  return "Đối tác đã gửi yêu cầu hủy, đang chờ bạn phản hồi.";
}
export function TerminationRequestCard({
  request: initialRequest,
  blocked,
  refresh,
  onUpdated,
  plain = false,
}: Readonly<{
  request: TerminationRequest;
  blocked: boolean;
  refresh: () => unknown;
  onUpdated?: (request: TerminationRequest) => void;
  plain?: boolean;
}>) {
  const runtime = useConnections();
  const api = usePathChangesApi();
  const [receipt, setReceipt] = useState<TerminationRequest>();
  const request = receipt ?? initialRequest;
  const command = useConnectionCommand<TerminationRequest>([
    ["learning-paths", request.pathId],
    ["learning-paths", "mine"],
    ["notifications"],
  ]);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<TerminationAction>();
  const actions = terminationActions(request, runtime.userId);
  const disabled =
    blocked || !runtime.enabled || command.pending || command.uncertain;
  const blockers = [
    request.blockedByDispute && "giải quyết tranh chấp",
    request.awaitingPolicy && "duyệt chính sách Credit",
  ].filter(Boolean);
  const cancellationNotice = cancellationStatusNotice(request, runtime.userId);
  const submitted = (result?: TerminationRequest) => {
    if (result && runtime.isCurrent()) {
      setReceipt(result);
      setConfirm(undefined);
      onUpdated?.(result);
      refresh();
    }
  };
  const open = (action: TerminationAction) => {
    if (disabled || confirm) return;
    Keyboard.dismiss();
    setNote("");
    setConfirm(action);
  };
  const close = () => {
    if (!command.pending && !command.uncertain) setConfirm(undefined);
  };
  const run = (action: TerminationAction) => {
    const available = terminationActions(request, runtime.userId);
    const allowed =
      action === "accept" || action === "decline"
        ? available.respond
        : available[action];
    if (
      disabled ||
      !allowed ||
      (action === "escalate" && !changeReason.safeParse(note).success)
    )
      return;
    const snapshot = {
      id: request.id,
      pathId: request.pathId,
      version: request.version,
      note: note.trim(),
    };
    void command
      .run(JSON.stringify({ ...snapshot, action }), () => {
        if (action === "withdraw")
          return api.withdraw(snapshot.pathId, snapshot.id, snapshot.version);
        if (action === "escalate")
          return api.escalate(
            snapshot.pathId,
            snapshot.id,
            snapshot.version,
            snapshot.note,
          );
        return api.respond(
          snapshot.pathId,
          snapshot.id,
          snapshot.version,
          action === "accept",
          snapshot.note,
        );
      })
      .then(submitted);
  };
  const feedback = (
    <>
      <TerminationFeedback
        error={command.uncertain ? undefined : command.error}
      />
      {command.uncertain && (
        <>
          <FormNotice tone="warning" compact>
            Chưa rõ kết quả. Kiểm tra trước khi thao tác tiếp.
          </FormNotice>
          <Button variant="paper" disabled={command.pending} onPress={refresh}>
            Tải lại yêu cầu
          </Button>
          <Button
            variant="paper"
            disabled={blocked || command.pending}
            onPress={() => {
              void command.retry().then(submitted);
            }}
          >
            Kiểm tra lại lần gửi trước
          </Button>
        </>
      )}
    </>
  );
  return (
    <View style={plain ? styles.plain : ui.surface}>
      <TerminationStatusHeader
        request={request}
        mine={request.requesterId === runtime.userId}
        canRespond={actions.respond}
      />
      <View style={ui.reason}>
        <Text style={ui.label}>Lý do hủy</Text>
        <Copy>{request.reason}</Copy>
      </View>
      {request.status === "ACCEPTED" && (
        <Copy size="hint">
          {request.approvedAt
            ? "Đã dừng các buổi tương lai. Hệ thống tự quyết toán Credit khi đủ điều kiện."
            : "Yêu cầu đã được đồng ý. Tải lại để xem kết quả xử lý."}
        </Copy>
      )}
      {request.status === "STAFF_REVIEW" && (
        <Copy size="hint">
          {request.accepted === false
            ? "Hai bên chưa thống nhất việc hủy. Nhân viên sẽ xem xét yêu cầu."
            : "Yêu cầu đã được gửi đến nhân viên hỗ trợ."}
        </Copy>
      )}
      {request.responseNote && (
        <View style={ui.reason}>
          <Text style={ui.label}>Ghi chú phản hồi</Text>
          <Copy>{request.responseNote}</Copy>
        </View>
      )}
      {openTermination(request) && blockers.length > 0 && (
        <FormNotice tone="warning" compact>
          {cancellationNotice} Credit chưa thể quyết toán: chờ{" "}
          {blockers.join(" và ")}.
        </FormNotice>
      )}
      <TerminationDecision request={request} />
      <TerminationRequestMetadata request={request} />
      {actions.respond && (
        <View style={styles.responses}>
          <Button
            variant="danger"
            size="sm"
            style={styles.response}
            disabled={disabled || !!confirm}
            onPress={() => open("accept")}
          >
            {actionLabels.accept}
          </Button>
          <Button
            variant="paper"
            size="sm"
            style={styles.response}
            disabled={disabled || !!confirm}
            onPress={() => open("decline")}
          >
            {actionLabels.decline}
          </Button>
        </View>
      )}
      {actions.withdraw && (
        <Button
          variant="paper"
          disabled={disabled || !!confirm}
          onPress={() => open("withdraw")}
        >
          {actionLabels.withdraw}
        </Button>
      )}
      {actions.escalate && (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || !!confirm}
          onPress={() => open("escalate")}
        >
          {actionLabels.escalate}
        </Button>
      )}
      {confirm && (
        <TerminationActionDialog
          action={confirm}
          note={note}
          onNoteChange={setNote}
          disabled={
            disabled ||
            (confirm === "escalate" && !changeReason.safeParse(note).success)
          }
          noteDisabled={disabled}
          closeDisabled={command.pending || command.uncertain}
          pending={command.pending}
          onConfirm={() => run(confirm)}
          onClose={close}
          feedback={feedback}
        />
      )}
      {!confirm && feedback}
    </View>
  );
}
const styles = StyleSheet.create({
  plain: { gap: 16 },
  responses: { gap: 8 },
  response: { alignSelf: "stretch" },
});
