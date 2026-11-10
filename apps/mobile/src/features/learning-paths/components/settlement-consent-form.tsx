import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { SafeAreaView } from "@/components/SafeArea";
import { Icon } from "@/components/Icon";
import { useConnections, useConnectionCommand } from "@/features/connections";
import type { SettlementStatus } from "../api/path-changes-contract";
import { usePathChangesApi } from "../hooks/use-path-changes";
import {
  canConsentToSettlement,
  submitSettlementConsent,
} from "../utils/settlement-consent";
import { TerminationFeedback } from "./termination-feedback";
import {
  appColors as colors,
  colors as semanticColors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function SettlementConsentForm({
  snapshot,
  blocked,
  refresh,
}: Readonly<{
  snapshot: SettlementStatus;
  blocked: boolean;
  refresh: () => unknown;
}>) {
  const runtime = useConnections();
  const api = usePathChangesApi();
  const command = useConnectionCommand<
    Awaited<ReturnType<typeof submitSettlementConsent>>
  >([
    ["learning-paths", snapshot.pathId],
    ["learning-paths", "mine"],
    ["notifications"],
  ]);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "info" | "warning" | "error";
  }>();
  const disabled =
    blocked ||
    !runtime.enabled ||
    command.pending ||
    command.uncertain ||
    !canConsentToSettlement(snapshot);
  const received = (
    result: Awaited<ReturnType<typeof submitSettlementConsent>> | undefined,
  ) => {
    if (!runtime.isCurrent() || !result) return;
    setReviewing(false);
    let message = "Đang cập nhật trạng thái quyết toán.";
    let tone: "info" | "warning" | "error" = "info";
    if (
      result.kind === "submitted" &&
      result.receipt.settlement.outcome === "RETRYING"
    ) {
      message =
        "Đã lưu đồng ý. Hệ thống đang thử lại; chưa xác nhận Credit đã chuyển.";
      tone = "warning";
    }
    if (
      result.kind === "submitted" &&
      result.receipt.settlement.outcome === "NEEDS_REVIEW"
    ) {
      message = "Đã lưu đồng ý. Quyết toán cần được hỗ trợ.";
      tone = "error";
    }
    setNotice({ text: message, tone });
    refresh();
  };
  const closeReview = () => {
    if (!command.pending && !command.uncertain) setReviewing(false);
  };
  const feedback = (
    <>
      <TerminationFeedback
        error={command.uncertain ? undefined : command.error}
      />
      {command.uncertain && (
        <>
          <FormNotice tone="warning" compact>
            Chưa rõ kết quả gửi. Kiểm tra trạng thái trước khi gửi lại.
          </FormNotice>
          <Button variant="paper" disabled={command.pending} onPress={refresh}>
            Kiểm tra kết quả
          </Button>
          <Button
            disabled={blocked || command.pending}
            onPress={() => {
              void command.retry().then(received);
            }}
          >
            Kiểm tra lại lần đồng ý trước
          </Button>
        </>
      )}
    </>
  );
  return (
    <>
      {notice && (
        <FormNotice tone={notice.tone} compact>
          {notice.text}
        </FormNotice>
      )}
      <Button
        variant="forest"
        disabled={disabled || reviewing}
        onPress={() => {
          if (disabled || reviewing) return;
          setNotice(undefined);
          setReviewing(true);
        }}
      >
        Đồng ý quyết toán sớm
      </Button>
      {reviewing && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeReview}
        >
          <SafeAreaView style={styles.overlay}>
            <View
              role="alertdialog"
              aria-modal
              accessibilityViewIsModal
              accessibilityLabel="Quyết toán sớm?"
              style={styles.review}
            >
              <ScrollView
                contentContainerStyle={styles.content}
                bounces={false}
              >
                <Text accessibilityRole="header" style={styles.title}>
                  Quyết toán sớm?
                </Text>
                <Text style={styles.description}>
                  Chỉ xác nhận khi bạn đã kiểm tra toàn bộ buổi học.
                </Text>
                <View style={styles.warning}>
                  <Icon name="alert" size={18} color={semanticColors.warning} />
                  <Text style={styles.warningText}>
                    Bỏ thời gian chờ còn lại khi cả hai cùng đồng ý.
                  </Text>
                </View>
                <Text style={styles.important}>
                  Báo cáo sau quyết toán không tự hoàn lại Credit.
                </Text>
                <View style={styles.actions}>
                  <Button
                    variant="forest"
                    disabled={disabled}
                    onPress={() => {
                      if (disabled) return;
                      void command
                        .run(
                          JSON.stringify({
                            pathId: snapshot.pathId,
                            version: snapshot.pathVersion,
                          }),
                          () => submitSettlementConsent(api, snapshot),
                        )
                        .then(received);
                    }}
                  >
                    {command.pending ? "Đang gửi đồng ý..." : "Xác nhận đồng ý"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={command.pending || command.uncertain}
                    onPress={closeReview}
                  >
                    Để sau
                  </Button>
                </View>
                {feedback}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      )}
      {!reviewing && feedback}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(28, 37, 32, 0.45)",
  },
  review: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  content: { padding: 24, gap: 16 },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  description: {
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.body,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: appRadius.button,
    backgroundColor: semanticColors.warningLight,
  },
  warningText: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: "#865B10",
  },
  important: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  actions: { gap: 4, marginTop: 4 },
});
