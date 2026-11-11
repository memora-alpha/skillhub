import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { FormNotice } from "@/components/FormNotice";
import { textRule } from "@/components/data-form";
import { ServerFilePicker } from "@/components/server-file-picker";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { UploadedFile } from "@/lib/http/file-upload";
import { AppError } from "@/lib/http/errors";
import {
  useConnections,
  useConnectionCommand,
  connectionError,
} from "@/features/connections";
import { reportReasons } from "../api/reports-api";
import { useReportsApi } from "../hooks/use-reports";
import {
  ReportPage,
  ReportSection,
  ReportCopy,
  ReportLink,
} from "../components/report-ui";
import { ReportReasonField } from "../components/report-reason-field";
import { reportStyles as s } from "../components/report.styles";
import { useReportFileCheck } from "../hooks/use-report-file-check";
const schema = z.object({
  reason: z.enum(reportReasons),
  description: textRule(10, 2000),
});
type Values = z.infer<typeof schema>;
export function ReportEditorScreen() {
  const { sessionId, materialId } = useLocalSearchParams<{
    sessionId?: string;
    materialId?: string;
  }>();
  const runtime = useConnections();
  return (
    <ReportEditor
      key={JSON.stringify([runtime.key, sessionId, materialId])}
      sessionId={sessionId}
      materialId={materialId}
    />
  );
}
function ReportEditor({
  sessionId,
  materialId,
}: Readonly<{ sessionId?: string; materialId?: string }>) {
  const api = useReportsApi(),
    runtime = useConnections(),
    router = useRouter(),
    cache = useQueryClient();
  const command = useConnectionCommand<{ id: string; status: string }>([
    ["reports"],
    ["learning-paths"],
  ]);
  const [files, setFiles] = useState<UploadedFile[]>([]),
    [uploading, setUploading] = useState(false);
  const sending = useRef(false),
    uploadBusy = useRef(false);
  const fileCheck = useReportFileCheck({
    read: api.fileStatus,
    isCurrent: runtime.isCurrent,
    update: (file) =>
      setFiles((current) =>
        current.map((item) => (item.fileId === file.fileId ? file : item)),
      ),
  });
  const { control, handleSubmit, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "TECHNICAL_ISSUE", description: "" },
    mode: "onBlur",
  });
  const id = materialId ?? sessionId,
    valid = z.uuid().safeParse(id).success && !(sessionId && materialId);
  const target = materialId ? "MATERIAL" : "SESSION";
  const targetHref: Href = valid
    ? materialId
      ? `/materials/${materialId}`
      : `/learning-sessions/${sessionId}`
    : "/reports";
  const busy =
    command.pending ||
    command.uncertain ||
    formState.isSubmitting ||
    fileCheck.checking;
  const submitDisabled = busy || uploading;
  const activeReport =
    command.error instanceof AppError &&
    command.error.status === 409 &&
    ["ACTIVE_SESSION_REPORT_EXISTS", "ACTIVE_MATERIAL_REPORT_EXISTS"].includes(
      command.error.code,
    );
  const submit = handleSubmit(async (values) => {
    if (
      !valid ||
      sending.current ||
      uploadBusy.current ||
      command.pending ||
      command.uncertain ||
      fileCheck.checking
    )
      return;
    sending.current = true;
    try {
      const checked = await fileCheck.check(files);
      if (!checked || !fileCheck.active()) return;
      const body = {
        reasonCode: values.reason,
        description: values.description,
        evidenceFileIds: checked.map((file) => file.fileId),
      };
      const receipt = await command.run(
        JSON.stringify({ target, id, body }),
        () => api.submit(target, id!, body),
      );
      if (receipt && runtime.isCurrent()) {
        await Promise.allSettled([
          cache.invalidateQueries({ queryKey: ["sessions"] }),
        ]);
        if (runtime.isCurrent()) router.replace(`/reports/${receipt.id}`);
      }
    } finally {
      sending.current = false;
    }
  });
  return (
    <ReportPage
      title={materialId ? "Báo cáo tài liệu" : "Báo cáo buổi học"}
      back={targetHref}
      selected={target === "SESSION" ? "Lịch học" : "Hồ sơ"}
    >
      {!valid ? (
        <EmptyState
          title="Chưa chọn nội dung cần báo cáo"
          titleStyle={s.heading}
          description="Mở báo cáo từ chi tiết buổi học hoặc tài liệu."
        />
      ) : (
        <>
          <View style={s.hero}>
            <View style={s.row}>
              <View style={s.heroIcon}>
                <Icon name="shield" size={22} color={colors.forest} />
              </View>
              <View style={s.grow}>
                <Text style={s.title}>Bạn gặp vấn đề gì?</Text>
                <Text style={s.meta}>
                  Chia sẻ chi tiết để SkillHub hỗ trợ bạn.
                </Text>
              </View>
            </View>
          </View>
          <>
            <ReportSection title="Nội dung báo cáo" icon="flag">
              <ReportLink
                title={
                  materialId ? "Tài liệu đang báo cáo" : "Buổi học đang báo cáo"
                }
                href={targetHref}
                icon={materialId ? "file" : "calendar"}
              />
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <ReportReasonField
                    target={target}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={busy}
                  />
                )}
              />
              <ControlledInput
                control={control}
                name="description"
                label="Mô tả vấn đề"
                reserveMessageSpace={false}
                required
                multiline
                maxLength={2000}
                editable={!busy}
                fieldStyle={s.field}
                style={s.description}
                placeholder="Điều gì đã xảy ra? Bạn cần được hỗ trợ điều gì?"
              />
              <Text style={s.counter}>{watch("description").length}/2000</Text>
            </ReportSection>
            {target === "SESSION" && (
              <ReportSection title="Bằng chứng đính kèm" icon="paperclip">
                <ReportCopy muted>
                  Không bắt buộc. Thêm ảnh hoặc tài liệu giúp làm rõ vấn đề.
                </ReportCopy>
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
                />
              </ReportSection>
            )}
          </>
          {fileCheck.error && (
            <FormNotice compact tone="error">
              {fileCheck.error}
            </FormNotice>
          )}
          {!!command.error && (
            <FormNotice compact tone="error">
              {connectionError(command.error)}
            </FormNotice>
          )}
          {activeReport && (
            <ReportLink
              title="Xem báo cáo đang xử lý"
              href="/reports"
              icon="clipboard"
            />
          )}
          {command.uncertain && (
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
            disabled={submitDisabled}
            onPress={() => {
              void submit();
            }}
            style={s.primary}
          >
            {command.uncertain
              ? "Chờ kiểm tra kết quả"
              : fileCheck.checking
                ? "Đang kiểm tra tệp…"
                : busy
                  ? "Đang gửi…"
                  : "Gửi báo cáo"}
          </Button>
        </>
      )}
    </ReportPage>
  );
}
