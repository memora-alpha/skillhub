import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { DataForm, textRule } from "@/components/data-form";
import { ChoiceGroup } from "@/components/choice-group";
import { SampleFiles } from "@/components/sample-files";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useSessionsPreview } from "@/features/sessions";
import { useMaterialsPreview } from "@/features/materials";
import { useReportsPreview } from "./context";
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
export function ReportsScreen() {
  const { reports } = useReportsPreview();
  const [filter, setFilter] = useState("Tất cả");
  const items = reports.filter(
    (r) => filter === "Tất cả" || r.status === filter,
  );
  return (
    <FeaturePage title="Báo cáo của tôi" back="/profile">
      <ChoiceGroup
        label="Trạng thái"
        options={["Tất cả", "OPEN", "NEED_MORE_INFO", "RESOLVED", "REJECTED"]}
        value={filter}
        onChange={setFilter}
      />
      {items.map((r) => (
        <Panel key={r.id} title={`Báo cáo ${r.id}`}>
          <Badge label={r.status} />
          <Copy>{r.description}</Copy>
          <RouteButton secondary href={`/reports/${r.id}`}>
            Theo dõi báo cáo
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Không có báo cáo"
          description="Báo cáo được gửi từ buổi học hoặc chi tiết tài liệu liên quan."
        />
      )}
      <RouteButton secondary href="/learning-history">
        Chọn buổi học cần báo cáo
      </RouteButton>
    </FeaturePage>
  );
}
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
            {pathId ? ` · lộ trình ${pathId}` : ""}
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
            Báo cáo tài liệu không cần lộ trình hoặc buổi học. Thời hạn tranh
            chấp và giới hạn tệp phụ thuộc chính sách được cấu hình.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
export function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports, save } = useReportsPreview();
  const r = reports.find((i) => i.id === id);
  const [files, setFiles] = useState<string[]>([]);
  return (
    <FeaturePage title="Theo dõi báo cáo" back="/reports">
      {!r ? (
        <EmptyState
          title="Không tìm thấy báo cáo"
          description="Báo cáo không có trong dữ liệu mẫu."
        />
      ) : (
        <>
          <Panel title={`Báo cáo ${r.id}`}>
            <Badge label={r.status} />
            <Copy>
              {r.reason} · {r.targetId}
            </Copy>
            <Copy>{r.description}</Copy>
            {r.files.map((f) => (
              <Copy key={f}>Bằng chứng riêng tư: {f}</Copy>
            ))}
            {r.note && <Copy>Phản hồi mẫu: {r.note}</Copy>}
            {r.additional && <Copy>Bổ sung: {r.additional}</Copy>}
          </Panel>
          {r.status === "NEED_MORE_INFO" && (
            <Panel title="Bổ sung thông tin">
              <SampleFiles value={files} onChange={setFiles} />
              <DataForm
                fields={[
                  {
                    name: "description",
                    label: "Thông tin bổ sung",
                    rule: textRule(20, 2000),
                    multiline: true,
                  },
                ]}
                submitLabel="Gửi bổ sung mẫu"
                onSubmit={(v) => {
                  if (r.files.length + files.length > 5)
                    return "Mỗi báo cáo có tối đa 5 tệp. Hãy bỏ bớt tệp bổ sung.";
                  save({
                    ...r,
                    additional: v.description,
                    files: [...r.files, ...files],
                    status: "UNDER_REVIEW",
                  });
                }}
              />
            </Panel>
          )}
          {r.pathId && (
            <RouteButton secondary href={`/paths/${r.pathId}`}>
              Xem lộ trình liên quan
            </RouteButton>
          )}
        </>
      )}
    </FeaturePage>
  );
}
