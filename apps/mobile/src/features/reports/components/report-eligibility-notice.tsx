import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import type { useSessionReporting } from "@/features/sessions/state";
import { RelatedSessionReportLink } from "./related-session-report-link";

export function ReportEligibilityNotice({
  eligibility,
  sessionId,
}: Readonly<{
  eligibility: ReturnType<typeof useSessionReporting>;
  sessionId: string;
}>) {
  return (
    <>
      <FormNotice compact tone="info">
        {eligibility.ready && eligibility.deadlineShort
          ? `Gửi trước ${eligibility.deadlineShort}`
          : eligibility.message}
      </FormNotice>
      {eligibility.reason === "ACTIVE_SESSION_REPORT_EXISTS" && (
        <RelatedSessionReportLink sessionId={sessionId} />
      )}
      {eligibility.retryable && !eligibility.checking && (
        <Button
          variant="paper"
          onPress={() => {
            void eligibility.refresh();
          }}
        >
          Thử kiểm tra lại
        </Button>
      )}
    </>
  );
}
