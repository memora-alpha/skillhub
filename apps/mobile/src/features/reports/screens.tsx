import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { EmptyState } from "@/components/EmptyState";
import { DataForm, textRule } from "@/components/data-form";
import { SampleFiles } from "@/components/sample-files";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { useSessionsPreview } from "@/features/sessions";
import { useMaterialsPreview } from "@/features/materials";
import { useReportsPreview } from "./context";
export {
  ReportsScreen,
  ReportDetailScreen,
} from "./screens/report-read-screens";
const reasons = [
  "NO_SHOW_LATE",
  "INAPPROPRIATE_BEHAVIOR",
  "HARASSMENT",
  "SKILL_MISMATCH",
  "FALSE_INFORMATION",
  "TECHNICAL_ISSUE",
  "CREDIT_ISSUE",
  "INAPPROPRIATE_CONTENT",
  "SPAM_SCAM",
  "OTHER",
];
export function ReportEditorScreen() {
  const { pathId, sessionId, materialId } = useLocalSearchParams<{
    pathId?: string;
    sessionId?: string;
    materialId?: string;
  }>();
  const { sessions } = useSessionsPreview();
  const { materials } = useMaterialsPreview();
  const { save } = useReportsPreview();
  const router = useRouter();
  const [files, setFiles] = useState<string[]>([]);
  const valid =
    (materialId &&
      materials.some(
        (m) =>
          m.id === materialId &&
          m.status === "PUBLISHED" &&
          m.owner === "partner",
      )) ||
    (sessionId &&
      pathId &&
      sessions.some((s) => s.id === sessionId && s.pathId === pathId));
  return (
    <FeaturePage
      title={materialId ? "Báo cáo tài liệu" : "Báo cáo buổi học"}
      back={
        materialId
          ? `/materials/${materialId}`
          : sessionId
            ? `/learning-sessions/${sessionId}`
            : "/reports"
      }
    >
      {!valid ? (
        <EmptyState
          title="Chưa chọn đối tượng hợp lệ"
          description="Mở báo cáo từ buổi học hoặc tài liệu liên quan."
        />
      ) : (
        <Panel title="Mô tả điều đã xảy ra">
          <Copy>
            Đối tượng: {materialId ?? sessionId}
            {pathId ? ` · Learning Path ${pathId}` : ""}
          </Copy>
          <SampleFiles value={files} onChange={setFiles} />
          <DataForm
            fields={[
              {
                name: "reason",
                label: "Loại vấn đề",
                rule: z
                  .string()
                  .refine((v) => reasons.includes(v), "Chọn loại vấn đề."),
                choices: reasons,
              },
              {
                name: "description",
                label: "Nội dung báo cáo",
                rule: textRule(20, 2000),
                multiline: true,
              },
            ]}
            submitLabel="Gửi báo cáo mẫu"
            onSubmit={(v) => {
              const id = `report-${Date.now()}`;
              save({
                id,
                target: materialId ? "MATERIAL" : "SESSION",
                targetId: (materialId ?? sessionId)!,
                pathId: materialId ? undefined : pathId,
                reason: v.reason!,
                description: v.description!,
                files,
                status: "OPEN",
              });
              router.replace(`/reports/${id}`);
            }}
          />
          <Copy muted>
            Báo cáo tài liệu không cần Learning Path hoặc buổi học. Thời hạn
            tranh chấp và giới hạn tệp phụ thuộc chính sách được cấu hình.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
