import { useState } from "react";
import { Keyboard } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { FlowSection } from "@/components/learning-flow";
import { useConnectionCommand, useConnections } from "@/features/connections";
import {
  changeReason,
  type TerminationRequest,
} from "../api/path-changes-contract";
import { usePathChangesApi } from "../hooks/use-path-changes";
import { TerminationFeedback } from "./termination-feedback";
import { TerminationConfirmDialog } from "./termination-confirm-dialog";

export function TerminationCreateForm({
  pathId,
  blocked,
  refresh,
}: Readonly<{
  pathId: string;
  blocked: boolean;
  refresh: () => unknown;
}>) {
  const runtime = useConnections();
  const api = usePathChangesApi();
  const command = useConnectionCommand<TerminationRequest>([
    ["learning-paths", pathId],
    ["learning-paths", "mine"],
    ["notifications"],
  ]);
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [sent, setSent] = useState(false);
  const valid = changeReason.safeParse(reason).success;
  const disabled =
    blocked || !runtime.enabled || command.pending || command.uncertain || sent;
  const submitted = (result?: TerminationRequest) => {
    if (result && runtime.isCurrent()) {
      setSent(true);
      setReviewing(false);
      refresh();
    }
  };
  const closeReview = () => {
    if (!command.pending && !command.uncertain) setReviewing(false);
  };
  const feedback = (
    <>
      <TerminationFeedback error={command.error} />
      {command.uncertain && (
        <>
          <FormNotice tone="warning" compact>
            Chưa rõ kết quả gửi. Kiểm tra trước khi gửi lại.
          </FormNotice>
          <Button variant="paper" disabled={command.pending} onPress={refresh}>
            Tải lại yêu cầu
          </Button>
          <Button
            variant="danger"
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
    <FlowSection title="Gửi yêu cầu hủy">
      <Copy size="hint">Đối tác sẽ nhận được yêu cầu và lý do của bạn.</Copy>
      <Input
        label="Lý do hủy"
        required
        value={reason}
        onChangeText={setReason}
        editable={!disabled && !reviewing}
        multiline
        maxLength={1000}
        placeholder="Vì sao bạn muốn dừng lộ trình?"
        hint="Từ 3 đến 1.000 ký tự."
      />
      <Button
        variant="danger"
        disabled={disabled || !valid || reviewing}
        onPress={() => {
          if (disabled || !valid || reviewing) return;
          Keyboard.dismiss();
          setReviewing(true);
        }}
      >
        {sent ? "Đã gửi yêu cầu hủy" : "Gửi yêu cầu hủy"}
      </Button>
      {reviewing && (
        <TerminationConfirmDialog
          reason={reason.trim()}
          disabled={disabled || !valid}
          closeDisabled={command.pending || command.uncertain}
          pending={command.pending}
          onClose={closeReview}
          feedback={feedback}
          onConfirm={() => {
            if (disabled || !valid) return;
            const snapshot = reason.trim();
            void command
              .run(JSON.stringify({ pathId, reason: snapshot }), (key) =>
                api.request(pathId, snapshot, key),
              )
              .then(submitted);
          }}
        />
      )}
      {!reviewing && feedback}
      {sent && (
        <FormNotice tone="success" compact>
          Đã gửi yêu cầu. Đang chờ phản hồi.
        </FormNotice>
      )}
      {sent && (
        <Button variant="paper" disabled={command.pending} onPress={refresh}>
          Tải lại yêu cầu
        </Button>
      )}
    </FlowSection>
  );
}
