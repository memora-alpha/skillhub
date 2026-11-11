import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { connectionError } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import { RelatedSessionReportLink } from "./related-session-report-link";
import { ReportCopy, ReportLink, ReportSection } from "./report-ui";
import { reportStyles as styles } from "./report.styles";

function ActiveReportNotice({
  error,
  reason,
  sessionId,
}: Readonly<{ error: unknown; reason: string | null; sessionId?: string }>) {
  const active =
    error instanceof AppError &&
    error.status === 409 &&
    ["ACTIVE_SESSION_REPORT_EXISTS", "ACTIVE_MATERIAL_REPORT_EXISTS"].includes(
      error.code,
    );
  if (!active || reason === "ACTIVE_SESSION_REPORT_EXISTS") return null;
  if (sessionId) return <RelatedSessionReportLink sessionId={sessionId} />;
  return (
    <ReportLink
      title="Xem báo cáo đang xử lý"
      href="/reports"
      icon="clipboard"
    />
  );
}

function submitLabel(
  uncertain: boolean,
  checkingFiles: boolean,
  busy: boolean,
) {
  if (uncertain) return "Chờ kiểm tra kết quả";
  if (checkingFiles) return "Đang kiểm tra tệp…";
  if (busy) return "Đang gửi…";
  return "Gửi báo cáo";
}

export function ReportSubmissionFeedback({
  error,
  fileError,
  reason,
  sessionId,
  uncertain,
  checkingFiles,
  busy,
  disabled,
  onSubmit,
}: Readonly<{
  error: unknown;
  fileError?: string;
  reason: string | null;
  sessionId?: string;
  uncertain: boolean;
  checkingFiles: boolean;
  busy: boolean;
  disabled: boolean;
  onSubmit: () => void;
}>) {
  return (
    <>
      {fileError && (
        <FormNotice compact tone="error">
          {fileError}
        </FormNotice>
      )}
      {!!error && (
        <FormNotice compact tone="error">
          {connectionError(error)}
        </FormNotice>
      )}
      <ActiveReportNotice error={error} reason={reason} sessionId={sessionId} />
      {uncertain && (
        <ReportSection title="Kiểm tra báo cáo đã gửi" icon="alert">
          <ReportCopy muted>
            Chưa rõ kết quả gửi. Kiểm tra danh sách trước khi gửi lại.
          </ReportCopy>
          <ReportLink
            title="Xem báo cáo của tôi"
            href="/reports"
            icon="clipboard"
          />
        </ReportSection>
      )}
      <Button
        variant="craft"
        leadingIcon="send"
        accessibilityLabel="Gửi báo cáo"
        disabled={disabled}
        onPress={onSubmit}
        style={styles.primary}
      >
        {submitLabel(uncertain, checkingFiles, busy)}
      </Button>
    </>
  );
}
