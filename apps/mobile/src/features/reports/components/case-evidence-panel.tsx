import { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { z } from "zod";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ServerFilePicker } from "@/components/server-file-picker";
import type { UploadedFile } from "@/lib/http/file-upload";
import { parse, timestamp } from "@/lib/http/contracts";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { useReportsApi, useCaseEvidence } from "../hooks/use-reports";
import { useReportFileCheck } from "../hooks/use-report-file-check";
import { reportFileLabel } from "../utils/report-presentation";
import { caseBlockedCopy } from "../utils/case-actions";
import { ReportCopy } from "./report-ui";
import { reportStyles as styles } from "./report.styles";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { caseThreadStyles as threadStyles } from "./case-thread.styles";

export function CaseEvidencePanel({
  caseId,
  writable,
  ownEvidenceCount,
  blockedReason,
}: Readonly<{
  caseId: string;
  writable: boolean;
  ownEvidenceCount?: number;
  blockedReason?: string | null;
}>) {
  const runtime = useConnections(),
    api = useReportsApi();
  const query = useCaseEvidence(caseId);
  const command = useConnectionCommand([["reports"], ["learning-paths"]]);
  const download = useConnectionCommand([]);
  const [files, setFiles] = useState<UploadedFile[]>([]),
    [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadBusy = useRef(false),
    sending = useRef(false);
  const fileCheck = useReportFileCheck({
    read: api.fileStatus,
    isCurrent: runtime.isCurrent,
    enabled: writable,
    update: (file) =>
      setFiles((current) =>
        current.map((item) => (item.fileId === file.fileId ? file : item)),
      ),
  });
  const root = `/reports/support/cases/${encodeURIComponent(caseId)}/parties/${encodeURIComponent(runtime.userId ?? "")}`;
  const busy = command.pending || command.uncertain || fileCheck.checking;
  async function send(file: UploadedFile) {
    if (!writable || busy || sending.current || uploadBusy.current) return;
    sending.current = true;
    try {
      const checked = await fileCheck.check([file]);
      if (!checked || !fileCheck.active()) return;
      await command.run(`evidence:${file.fileId}`, async () => {
        const result = await runtime.call(`${root}/evidence`, {
          method: "POST",
          body: { fileId: file.fileId },
          replayAfterRenewal: false,
        });
        if (runtime.isCurrent())
          setFiles((current) =>
            current.filter((item) => item.fileId !== file.fileId),
          );
        return result;
      });
    } finally {
      sending.current = false;
    }
  }
  function toggleLabel() {
    if (open) return "Thu gọn bằng chứng";
    return writable ? "Xem / bổ sung bằng chứng" : "Xem bằng chứng";
  }
  return (
    <>
      <Button
        variant="ghost"
        style={threadStyles.evidenceToggle}
        accessibilityLabel={toggleLabel()}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Icon name="paperclip" size={16} color={appColors.muted} />
        <Text style={threadStyles.evidenceLabel}>Bằng chứng</Text>
        <Text style={threadStyles.evidenceCount}>
          {ownEvidenceCount ?? query.data?.length ?? 0} tệp
        </Text>
        <View style={open ? { transform: [{ rotate: "90deg" }] } : undefined}>
          <Icon name="chevron" size={16} color={appColors.muted} />
        </View>
      </Button>
      {open && (
        <View style={styles.attachments}>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error ?? command.error ?? download.error}
            retry={() => {
              void query.refetch();
            }}
          />
          {query.data?.map((file, index) => (
            <Button
              key={file.id}
              variant="paper"
              leadingIcon="file"
              accessibilityLabel={`Mở bằng chứng ${index + 1}`}
              onPress={() =>
                void download.run(`download:${file.id}`, async () => {
                  const result = parse(
                    z.object({ url: z.url(), expiresAt: timestamp }),
                    await runtime.call(`${root}/evidence/${file.id}/download`),
                  );
                  if (runtime.isCurrent()) await Linking.openURL(result.url);
                  return result;
                })
              }
            >
              {reportFileLabel(file.mimeType, file.fileSizeBytes)}
            </Button>
          ))}
          {!writable &&
            blockedReason &&
            blockedReason !== "REPORT_CASE_CLOSED" && (
              <ReportCopy muted>{caseBlockedCopy(blockedReason)}</ReportCopy>
            )}
          {writable && (
            <>
              <ServerFilePicker
                compact
                allowPhotos
                checkOnSubmit
                files={files}
                onChange={(next) => {
                  fileCheck.clearError();
                  setFiles(next);
                }}
                upload={api.upload}
                status={api.fileStatus}
                isCurrent={runtime.isCurrent}
                disabled={busy}
                onBusyChange={(value) => {
                  uploadBusy.current = value;
                  setUploading(value);
                }}
                maxCount={Math.max(
                  0,
                  5 - (ownEvidenceCount ?? query.data?.length ?? 0),
                )}
              />
              {fileCheck.error && (
                <FormNotice compact tone="error">
                  {fileCheck.error}
                </FormNotice>
              )}
              {files.map((file) => (
                <Button
                  key={file.fileId}
                  disabled={busy || uploading}
                  onPress={() => {
                    void send(file);
                  }}
                >
                  {fileCheck.checking
                    ? "Đang kiểm tra tệp…"
                    : `Gửi ${file.name}`}
                </Button>
              ))}
            </>
          )}
        </View>
      )}
      {download.uncertain && (
        <Button
          variant="paper"
          disabled={download.pending}
          onPress={() => void download.retry()}
        >
          Thử mở lại bằng chứng
        </Button>
      )}
      {command.uncertain && writable && (
        <>
          <ReportCopy muted>
            Chưa rõ kết quả gửi. Kiểm tra hoặc gửi lại cùng tệp.
          </ReportCopy>
          <Button
            variant="paper"
            disabled={command.pending}
            onPress={() => void command.retry()}
          >
            Kiểm tra / gửi lại
          </Button>
        </>
      )}
    </>
  );
}
