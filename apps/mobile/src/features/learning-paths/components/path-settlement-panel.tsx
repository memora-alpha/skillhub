import { StyleSheet, Text, View } from "react-native";
import { Copy, RouteButton } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { useConnections } from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { PathReadFeedback } from "./PathReadFeedback";
import { usePathSettlement } from "../hooks/use-path-changes";
import { SettlementConsentForm } from "./settlement-consent-form";
import { canConsentToSettlement } from "../utils/settlement-consent";
import {
  settlementWaitNote,
  settlementWarnings,
} from "../utils/settlement-summary";

// Completion summary only; automatic settlement never requires a manual refresh command.
export function PathSettlementPanel({ pathId }: Readonly<{ pathId: string }>) {
  const query = usePathSettlement(pathId);
  const runtime = useConnections();
  const status = query.data;
  const settled = status?.status === "SETTLED";
  const warning = status && settlementWarnings[status.status];
  const waiting =
    status && ["WAITING_DISPUTE_WINDOW", "READY"].includes(status.status);
  return (
    <View style={styles.summary}>
      <View style={styles.heading}>
        <View style={styles.check}>
          <Icon name="check-circle" size={24} color={colors.forest} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.eyebrow}>HOÀN THÀNH</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {settled
              ? "Thỏa thuận đã hoàn tất"
              : "Đã học xong · Chờ quyết toán"}
          </Text>
          <Text style={styles.subtitle}>Các buổi học đã hoàn tất.</Text>
        </View>
      </View>
      <PathReadFeedback query={query} />
      {!status && !query.error && !query.isLoading && (
        <Copy size="hint">Kết nối mạng để xem trạng thái Credit.</Copy>
      )}
      {settled && (
        <Text style={styles.settled}>Credit đã được quyết toán.</Text>
      )}
      {status?.settledAt && (
        <Copy size="hint">
          Ghi nhận {new Date(status.settledAt).toLocaleString("vi-VN")}
        </Copy>
      )}
      {waiting && (
        <View style={styles.timing}>
          <Text style={styles.label}>Tự động quyết toán Credit</Text>
          <Text style={styles.deadline}>{settlementWaitNote(status)}</Text>
          {status.autoSettlementAt && (
            <Text style={styles.date}>
              Dự kiến ·{" "}
              {new Date(status.autoSettlementAt).toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
          <Text style={styles.date}>
            Không cần thao tác thêm nếu đủ điều kiện.
          </Text>
        </View>
      )}
      {status && ["NOT_LOCKED", "WAITING_SESSIONS"].includes(status.status) && (
        <Copy size="hint">Máy chủ đang cập nhật điều kiện quyết toán.</Copy>
      )}
      {warning && (
        <FormNotice
          tone={status.status === "NEEDS_REVIEW" ? "error" : "warning"}
          compact
        >
          {warning}
        </FormNotice>
      )}
      {status?.status === "TERMINATED" && (
        <Copy>Lộ trình đã hủy. Credit được xử lý theo quyết định hủy.</Copy>
      )}
      {status?.immediateSettlement?.ownApprovedAt && !settled && (
        <Copy size="hint">
          {status.immediateSettlement.partnerApprovedAt
            ? "Cả hai đã đồng ý · Đang xử lý quyết toán."
            : "Bạn đã đồng ý · Chờ đối tác hoặc hết thời gian chờ."}
        </Copy>
      )}
      {status?.immediateSettlement?.partnerApprovedAt &&
        !status.immediateSettlement.ownApprovedAt &&
        !settled && <Copy size="hint">Đối tác đã đồng ý quyết toán sớm.</Copy>}
      {status && canConsentToSettlement(status) && (
        <SettlementConsentForm
          key={JSON.stringify([runtime.key, pathId, status.pathVersion])}
          snapshot={status}
          blocked={!!query.error || query.isFetching || !runtime.enabled}
          refresh={() => {
            void query.refetch({ cancelRefetch: false });
          }}
        />
      )}
      {status?.status === "WAITING_DISPUTE" && (
        <RouteButton secondary href={`/paths/${pathId}?cases=1`}>
          Xem vụ việc đang chặn
        </RouteButton>
      )}
      {status &&
        ["WAITING_TERMINATION", "TERMINATED"].includes(status.status) && (
          <RouteButton secondary href={`/paths/${pathId}/cancel`}>
            Xem yêu cầu hủy
          </RouteButton>
        )}
      {status?.status === "NEEDS_REVIEW" && (
        <RouteButton secondary href="/help">
          Xem trợ giúp
        </RouteButton>
      )}
      {settled && (
        <RouteButton secondary href="/wallet/history">
          Xem giao dịch ví
        </RouteButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    padding: 20,
    gap: 16,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  check: {
    width: 40,
    height: 40,
    borderRadius: appRadius.full,
    backgroundColor: colors.forestSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  eyebrow: {
    ...typography.caption,
    fontFamily: fonts.bold,
    color: colors.forest,
  },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  subtitle: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: 2,
  },
  timing: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
    gap: 5,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.body,
  },
  deadline: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  date: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  settled: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.forest,
  },
});
