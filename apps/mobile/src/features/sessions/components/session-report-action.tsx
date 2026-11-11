import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSessionReport } from "@/features/reports/state";
import { useSessionReporting } from "../hooks/use-session-reporting";
import { SessionActionRow } from "./session-section";
import { sectionStyles as styles } from "./session-section.styles";
import type { IconName } from "@/components/Icon";

type ReportRead = ReturnType<typeof useSessionReport>;
type Reporting = ReturnType<typeof useSessionReporting>;

function reportActionVariant(
  hasReport: boolean,
  retryable: boolean,
): { title: string; icon: IconName } {
  if (hasReport) return { title: "Xem báo cáo", icon: "clipboard" };
  if (retryable) return { title: "Tải lại thông tin", icon: "refresh" };
  return { title: "Báo sự cố", icon: "flag" };
}

function reportActionHint(
  read: ReportRead,
  reporting: Reporting,
  checking: boolean,
  hasReport: boolean,
) {
  if (read.report) return read.report.statusLabel;
  if (checking) return "Đang cập nhật…";
  if (read.error || hasReport) return "Chưa tải được báo cáo. Chạm để thử lại.";
  if (reporting.ready && reporting.deadlineShort)
    return `Gửi trước ${reporting.deadlineShort}`;
  return reporting.message;
}

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
  const { title, icon } = reportActionVariant(hasReport, retryable);
  const hint = reportActionHint(reportRead, reporting, checking, hasReport);
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
        icon={icon}
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
