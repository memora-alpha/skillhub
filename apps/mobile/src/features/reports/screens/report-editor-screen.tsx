import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { DataForm, textRule } from "@/components/data-form";
import { ServerFilePicker } from "@/components/server-file-picker";
import type { UploadedFile } from "@/lib/http/file-upload";
import {
  useConnections,
  useConnectionCommand,
  connectionError,
} from "@/features/connections";
import { reportReasons } from "../api/reports-api";
import { useReportsApi } from "../hooks/use-reports";

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
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const id = materialId ?? sessionId,
    valid = z.uuid().safeParse(id).success && !(sessionId && materialId);
  const target = materialId ? "MATERIAL" : "SESSION";
  return (
    <FeaturePage
      demo={false}
      title={materialId ? "Báo cáo tài liệu" : "Báo cáo buổi học"}
      back="/reports"
    >
      {!valid ? (
        <EmptyState
          title="Chưa chọn đối tượng hợp lệ"
          description="Mở báo cáo từ chi tiết buổi học hoặc tài liệu."
        />
      ) : (
        <Panel title="Mô tả điều đã xảy ra">
          <Copy>Đối tượng: {id}</Copy>
          {target === "SESSION" && (
            <Copy>
              Báo cáo được gửi khi có vấn đề trong hoặc sau buổi học, kể cả một
              bên vắng. Máy chủ kiểm tra thời hạn và quyền gửi; báo cáo sau
              quyết toán không tự đảo giao dịch Credit.
            </Copy>
          )}
          {target === "SESSION" && (
            <ServerFilePicker
              files={files}
              onChange={setFiles}
              upload={api.upload}
              status={api.fileStatus}
              isCurrent={runtime.isCurrent}
              disabled={command.pending || command.uncertain}
            />
          )}
          {!!command.error && (
            <FormNotice tone="error">
              {connectionError(command.error)}
            </FormNotice>
          )}
          {command.uncertain && (
            <>
              <Copy>
                Chưa xác định được kết quả gửi. Kiểm tra danh sách báo cáo trước
                khi gửi lại.
              </Copy>
              <RouteButton href="/reports">Kiểm tra báo cáo đã gửi</RouteButton>
            </>
          )}
          <DataForm
            fields={[
              {
                name: "reason",
                label: "Loại vấn đề",
                rule: z.enum(reportReasons),
                choices: reportReasons,
              },
              {
                name: "description",
                label: "Nội dung báo cáo",
                rule: textRule(10, 2000),
                multiline: true,
              },
            ]}
            submitLabel="Gửi báo cáo"
            disabled={
              command.pending ||
              command.uncertain ||
              files.some((file) => file.state !== "READY")
            }
            onSubmit={async (values) => {
              const body = {
                reasonCode: values.reason as (typeof reportReasons)[number],
                description: values.description!,
                evidenceFileIds: files.map((file) => file.fileId),
              };
              const receipt = await command.run(
                JSON.stringify({ target, id, body }),
                () => api.submit(target, id!, body),
              );
              if (receipt && runtime.isCurrent()) {
                await cache.invalidateQueries({ queryKey: ["sessions"] });
                router.replace(`/reports/${receipt.id}`);
              }
            }}
          />
        </Panel>
      )}
    </FeaturePage>
  );
}
