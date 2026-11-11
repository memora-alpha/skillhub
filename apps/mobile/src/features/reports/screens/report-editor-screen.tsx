import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { EmptyState } from "@/components/EmptyState";
import { ControlledInput } from "@/components/ControlledInput";
import { textRule } from "@/components/data-form";
import { ServerFilePicker } from "@/components/server-file-picker";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { UploadedFile } from "@/lib/http/file-upload";
import { useConnections, useConnectionCommand } from "@/features/connections";
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
import { useSessionReporting } from "@/features/sessions/state";
import { ReportEligibilityNotice } from "../components/report-eligibility-notice";
import { ReportSubmissionFeedback } from "../components/report-submission-feedback";
const schema = z.object({
  reason: z.enum(reportReasons),
  description: textRule(10, 2000),
});
type Values = z.infer<typeof schema>;

function reportTargetHref(
  valid: boolean,
  materialId?: string,
  sessionId?: string,
): Href {
  if (!valid) return "/reports";
  if (materialId) return `/materials/${materialId}`;
  return `/learning-sessions/${sessionId}`;
}

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
  const eligibility = useSessionReporting(!materialId ? sessionId : undefined);
  const permitted = !!materialId || eligibility.permitted;
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (permitted) setOpened(true);
  }, [permitted]);
  const fileCheck = useReportFileCheck({
    read: api.fileStatus,
    isCurrent: runtime.isCurrent,
    enabled: permitted,
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
  const targetHref = reportTargetHref(valid, materialId, sessionId);
  const busy =
    command.pending ||
    command.uncertain ||
    formState.isSubmitting ||
    fileCheck.checking;
  const formDisabled =
    busy || !permitted || (!materialId && eligibility.checking);
  const submitDisabled = formDisabled || uploading;
  const submit = handleSubmit(async (values) => {
    if (
      !valid ||
      !permitted ||
      (!materialId && !eligibility.ready) ||
      sending.current ||
      uploadBusy.current ||
      command.pending ||
      command.uncertain ||
      fileCheck.checking
    )
      return;
    sending.current = true;
    try {
      if (!materialId && !(await eligibility.recheck())) return;
      if (!fileCheck.active()) return;
      const checked = await fileCheck.check(files);
      if (!checked || !fileCheck.active()) return;
      if (!materialId && files.length > 0 && !(await eligibility.recheck()))
        return;
      if (!fileCheck.active()) return;
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
      } else if (!materialId && runtime.isCurrent()) void eligibility.refresh();
    } finally {
      sending.current = false;
    }
  });
  return (
    <ReportPage
      title={materialId ? "Báo cáo tài liệu" : "Báo cáo buổi học"}
      back={targetHref}
      selected={target === "SESSION" ? "Lịch học" : "Hồ sơ"}
      onRefresh={!materialId ? eligibility.refresh : undefined}
    >
      {!valid ? (
        <EmptyState
          title="Chưa chọn nội dung cần báo cáo"
          titleStyle={s.heading}
          description="Mở báo cáo từ chi tiết buổi học hoặc tài liệu."
        />
      ) : (
        <>
          {!materialId && (
            <ReportEligibilityNotice
              eligibility={eligibility}
              sessionId={sessionId ?? ""}
            />
          )}
          {(opened || permitted) && (
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
              <ReportSection title="Nội dung báo cáo" icon="flag">
                {materialId && (
                  <ReportLink
                    title="Tài liệu đang báo cáo"
                    href={targetHref}
                    icon="file"
                  />
                )}
                <Controller
                  control={control}
                  name="reason"
                  render={({ field }) => (
                    <ReportReasonField
                      target={target}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={formDisabled}
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
                  editable={!formDisabled}
                  fieldStyle={s.field}
                  style={s.description}
                  placeholder="Điều gì đã xảy ra? Bạn cần được hỗ trợ điều gì?"
                />
                <Text style={s.counter}>
                  {watch("description").length}/2000
                </Text>
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
                    disabled={formDisabled}
                    onBusyChange={(value) => {
                      uploadBusy.current = value;
                      setUploading(value);
                    }}
                  />
                </ReportSection>
              )}
              <ReportSubmissionFeedback
                error={command.error}
                fileError={fileCheck.error}
                reason={eligibility.reason}
                sessionId={sessionId}
                uncertain={command.uncertain}
                checkingFiles={fileCheck.checking}
                busy={busy}
                disabled={submitDisabled}
                onSubmit={() => {
                  void submit();
                }}
              />
            </>
          )}
        </>
      )}
    </ReportPage>
  );
}
