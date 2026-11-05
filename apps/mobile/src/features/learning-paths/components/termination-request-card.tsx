import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { FlowSection } from "@/components/learning-flow";
import { useConnectionCommand, useConnections } from "@/features/connections";
import {
  changeReason,
  type TerminationRequest,
} from "../api/path-changes-contract";
import { usePathChangesApi } from "../hooks/use-path-changes";
import {
  terminationActions,
  terminationLabels,
  openTermination,
} from "../utils/termination-policy";
import { TerminationDecision } from "./termination-decision";
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
export function TerminationRequestCard({
  request: initialRequest,
  blocked,
  refresh,
}: Readonly<{
  request: TerminationRequest;
  blocked: boolean;
  refresh: () => unknown;
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
  const submitted = (result?: TerminationRequest) => {
    if (result && runtime.isCurrent()) {
      setReceipt(result);
      setConfirm(undefined);
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
      <TerminationFeedback error={command.error} />
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
    <FlowSection
      title={
        actions.respond
          ? "Đối tác muốn hủy lộ trình"
          : terminationLabels[request.status]
      }
    >
      <Copy size="hint">
        {request.requesterId === runtime.userId
          ? "Bạn đã gửi yêu cầu"
          : "Đối tác đã gửi yêu cầu"}
      </Copy>
      <Copy>Lý do: {request.reason}</Copy>
      {request.status === "PENDING" && (
        <Copy size="hint">
          Hạn phản hồi{" "}
          {new Date(request.expiresAt).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Copy>
      )}
      {request.status === "ACCEPTED" && (
        <Copy size="hint">Chờ Admin quyết định hủy và xử lý Credit.</Copy>
      )}
      {request.status === "STAFF_REVIEW" && (
        <Copy size="hint">
          {request.accepted === false
            ? "Hai bên chưa thống nhất việc hủy. Nhân viên sẽ xem xét yêu cầu."
            : "Yêu cầu đã được gửi đến nhân viên hỗ trợ."}
        </Copy>
      )}
      {request.responseNote && <Copy>Phản hồi: {request.responseNote}</Copy>}
      {openTermination(request) && blockers.length > 0 && (
        <FormNotice tone="warning" compact>
          Đã gửi yêu cầu, lộ trình chưa hủy. Chờ {blockers.join(" và ")}.
        </FormNotice>
      )}
      <TerminationDecision request={request} />
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
    </FlowSection>
  );
}
const styles = StyleSheet.create({
  responses: { flexDirection: "row", gap: 8 },
  response: { flex: 1 },
});
