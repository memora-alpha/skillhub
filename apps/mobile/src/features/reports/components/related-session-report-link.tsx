import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useSessionReport } from "../hooks/use-session-report";
import { ReportLink } from "./report-ui";

export function RelatedSessionReportLink({
  sessionId,
}: Readonly<{ sessionId: string }>) {
  const query = useSessionReport(sessionId),
    router = useRouter();
  if (query.report)
    return (
      <ReportLink
        title="Xem báo cáo"
        href={`/reports/${query.report.id}`}
        icon="clipboard"
      />
    );
  return (
    <Button
      variant="paper"
      leadingIcon="clipboard"
      disabled={query.checking}
      onPress={() => {
        void query.refresh().then((report) => {
          if (report && query.isCurrent()) router.push(`/reports/${report.id}`);
        });
      }}
    >
      {query.checking ? "Đang tải báo cáo…" : "Xem báo cáo"}
    </Button>
  );
}
