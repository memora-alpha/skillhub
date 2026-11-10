import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { appColors as colors } from "@/constants/theme";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { cancellationStyles as ui } from "./cancellation-styles";
import { useConnectionCommand, useConnections } from "@/features/connections";
import {
  changeReason,
  type TerminationRequest,
} from "../api/path-changes-contract";
import { usePathChangesApi } from "../hooks/use-path-changes";
import { TerminationFeedback } from "./termination-feedback";
import { TerminationConfirmDialog } from "./termination-confirm-dialog";
import { useLearningPathsApi } from "../hooks/use-learning-paths-api";
import { preflightTerminationRequest } from "../utils/termination-preflight";

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
  const paths = useLearningPathsApi();
  const mounted = useRef(true);
  const preparing = useRef(false);
  const [checking, setChecking] = useState(false);
  const [preflightError, setPreflightError] = useState<unknown>();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
    blocked ||
    !runtime.enabled ||
    checking ||
    command.pending ||
    command.uncertain ||
    sent;
  const submitted = (result?: TerminationRequest) => {
    if (result && mounted.current && runtime.isCurrent()) {
      setSent(true);
      setReviewing(false);
      refresh();
    }
  };
  const closeReview = () => {
    if (!preparing.current && !command.pending && !command.uncertain)
      setReviewing(false);
  };
  const confirm = async () => {
    if (disabled || !valid || preparing.current) return;
    const snapshot = reason.trim();
    const isCurrent = () => mounted.current && runtime.isCurrent();
    preparing.current = true;
    setChecking(true);
    setPreflightError(undefined);
    try {
      await preflightTerminationRequest({
        pathId,
        userId: runtime.userId,
        isCurrent,
        readPath: () => paths.detail(pathId),
        readRequests: () => api.list(pathId),
      });
      if (!isCurrent()) return;
      const result = await command.run(
        JSON.stringify({ pathId, reason: snapshot }),
        (key) => api.request(pathId, snapshot, key),
      );
      submitted(result);
    } catch (error) {
      if (isCurrent()) {
        setPreflightError(error);
        refresh();
      }
    } finally {
      preparing.current = false;
      if (isCurrent()) setChecking(false);
    }
  };
  const feedback = (
    <>
      <TerminationFeedback
        error={command.uncertain ? undefined : command.error}
      />
      <TerminationFeedback error={preflightError} />
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
    <View style={ui.surface}>
      <View style={ui.header}>
        <Text style={ui.eyebrow}>THỐNG NHẤT VỚI ĐỐI TÁC</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Gửi yêu cầu hủy
        </Text>
        <Copy size="hint">
          Chia sẻ lý do để đối tác hiểu và phản hồi yêu cầu của bạn.
        </Copy>
      </View>
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
        fieldStyle={styles.field}
        style={styles.input}
      />
      <View style={ui.footnote}>
        <Icon name="shield" size={16} color={colors.muted} />
        <Text style={ui.text}>
          Lịch học vẫn có hiệu lực đến khi được duyệt hủy. Credit chưa được hoàn
          ngay khi gửi.
        </Text>
      </View>
      <Button
        variant="primary"
        leadingIcon="send"
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
          closeDisabled={checking || command.pending || command.uncertain}
          pending={command.pending}
          checking={checking}
          onClose={closeReview}
          feedback={feedback}
          onConfirm={() => {
            void confirm();
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.canvas, borderRadius: 12 },
  input: { minHeight: 116, textAlignVertical: "top" },
});
