import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Copy } from "@/components/feature-page";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { cancellationStyles as ui } from "./cancellation-styles";
import { useConnections } from "@/features/connections";
import type { TerminationQuote } from "../api/termination-quote-contract";
import { terminationQuoteNotes } from "../utils/termination-quote-summary";
import { useTerminationQuote } from "../hooks/use-termination-quote";
import { PathReadFeedback } from "./PathReadFeedback";
import { TerminationCreditAmounts } from "./termination-credit-amounts";

export function TerminationCreditPreview({
  pathId,
}: Readonly<{ pathId: string }>) {
  const query = useTerminationQuote(pathId);
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={ui.surface}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? "Thu gọn Credit dự kiến" : "Xem Credit dự kiến"
        }
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.disclosure}
      >
        <Icon name="wallet" size={22} color={colors.primary} />
        <View style={styles.summary}>
          <Text style={styles.title}>Credit khi hủy</Text>
          <Text style={styles.hint}>Xem khoản hoàn lại và phí dự kiến</Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={18} color={colors.muted} />
        </View>
      </Pressable>
      {expanded && (
        <>
          <PathReadFeedback query={query} />
          {query.error && query.data && (
            <Copy size="hint">
              Bản dự kiến chưa được cập nhật. Kéo xuống để tải lại.
            </Copy>
          )}
          {!query.data && !query.error && !query.isLoading && (
            <Copy size="hint">Kết nối mạng để xem Credit dự kiến.</Copy>
          )}
          {query.data && !query.denied && (
            <TerminationQuoteDetails quote={query.data} />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  summary: { flex: 1, gap: 4 },
  title: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  hint: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});

export function TerminationQuoteDetails({
  quote,
}: Readonly<{ quote: TerminationQuote }>) {
  const runtime = useConnections();
  const notes = terminationQuoteNotes(quote.reasonCodes);
  return (
    <>
      <Copy size="hint">
        Đã hoàn thành {quote.completedSessions}/{quote.totalSessions} buổi
      </Copy>
      {quote.allocations.map((allocation) => (
        <TerminationCreditAmounts
          key={allocation.allocationId}
          title={
            allocation.userId === runtime.userId
              ? "Khoản của bạn"
              : "Khoản của đối tác"
          }
          refund={allocation.refund}
          counterpartyPayment={allocation.counterpartyPayment}
          platformFee={allocation.platformFee}
          compensationCredit={allocation.compensationCredit}
        />
      ))}
      {notes.length > 0 && (
        <FormNotice tone="warning" compact>
          {notes.join(" ")}
        </FormNotice>
      )}
      <Copy size="hint">
        Tạm tính theo dữ liệu hiện tại. Credit chỉ được xử lý khi đủ điều kiện
        quyết toán.
      </Copy>
    </>
  );
}
