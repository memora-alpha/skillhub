import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSessionReport } from "@/features/reports/state";
import { useSessionReporting } from "../hooks/use-session-reporting";
import { SessionActionRow } from "./session-section";
import { sectionStyles as styles } from "./session-section.styles";

export function SessionReportAction({
  sessionId,
  disabled,
}: Readonly<{ sessionId: string; disabled: boolean }>) {
  const router = useRouter(),
    reporting = useSessionReporting(sessionId);
  const reportRead = useSessionReport(sessionId),
    report = reportRead.report;
  const hasReport =
    !!report || reporting.reason === "ACTIVE_SESSION_REPORT_EXISTS";
  const checking = reportRead.checking || reporting.checking;
  const retryable =
    !report &&
    !checking &&
    (!!reportRead.error || reporting.retryable || hasReport);
  const title = hasReport
    ? "Xem báo cáo"
    : retryable
      ? "Tải lại thông tin"
      : "Báo sự cố";
  const hint = report
    ? report.statusLabel
    : checking
      ? "Đang cập nhật…"
      : reportRead.error || (hasReport && !report)
        ? "Chưa tải được báo cáo. Chạm để thử lại."
        : reporting.ready && reporting.deadlineShort
          ? `Gửi trước ${reporting.deadlineShort}`
          : reporting.message;
  async function act() {
    if (!reportRead.isCurrent()) return;
    if (report) return router.push(`/reports/${report.id}`);
    if (retryable) {
      const [found] = await Promise.all([
        reportRead.refresh(),
        reporting.refresh(),
      ]);
      if (found && reportRead.isCurrent()) router.push(`/reports/${found.id}`);
      return;
    }
    if (reporting.ready && !checking)
      router.push({ pathname: "/reports/new", params: { sessionId } });
  }
  return (
    <View style={styles.reportAction}>
      <SessionActionRow
        title={title}
        icon={hasReport ? "clipboard" : retryable ? "refresh" : "flag"}
        disabled={
          disabled || checking || (!report && !retryable && !reporting.ready)
        }
        onPress={() => {
          void act();
        }}
      />
      <Text style={styles.reportReminderText} accessibilityLiveRegion="polite">
        {hint}
      </Text>
    </View>
  );
}
