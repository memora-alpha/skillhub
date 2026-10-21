import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChoiceGroup } from "@/components/choice-group";
import { DataForm, creditRule } from "@/components/data-form";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { usePathsPreview } from "../context";
import { uuid } from "@/lib/http/contracts";
import { ApiTermsScreen } from "./ApiTermsScreen";
export function TermsEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuid.safeParse(id).success ? (
    <ApiTermsScreen />
  ) : (
    <PreviewTermsEditorScreen />
  );
}
function PreviewTermsEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  const router = useRouter();
  const [type, setType] = useState(path?.type ?? "TWO_WAY");
  const [role, setRole] = useState(
    path?.teacher === "partner" ? "Tôi học" : "Tôi dạy",
  );
  return (
    <FeaturePage title="Điều chỉnh điều khoản" back={`/paths/${id}`}>
      {!path || path.status !== "PROPOSED" ? (
        <EmptyState
          title="Điều khoản đã khóa"
          description="Sau khi chốt lịch, thay đổi điều khoản cần quy trình sửa đổi và đối soát tạm giữ riêng."
        />
      ) : (
        <Panel title="Thống nhất lại trước khi chốt">
          <ChoiceGroup
            label="Hình thức"
            options={["TWO_WAY", "ONE_WAY"]}
            value={type}
            onChange={(v) => setType(v as typeof type)}
          />
          {type === "ONE_WAY" && (
            <ChoiceGroup
              label="Vai trò đề xuất"
              options={["Tôi dạy", "Tôi học"]}
              value={role}
              onChange={setRole}
            />
          )}
          <DataForm
            key={type}
            defaults={{ credit: path.credit }}
            fields={[
              {
                name: "credit",
                label:
                  type === "TWO_WAY"
                    ? "Cam kết mỗi người (CR)"
                    : "Giá dạy toàn Learning Path (CR)",
                rule: creditRule(
                  type === "TWO_WAY" ? 20 : 0,
                  type === "TWO_WAY",
                ),
                numeric: true,
              },
            ]}
            submitLabel="Gửi điều khoản mẫu mới"
            onSubmit={(v) => {
              const teacher =
                type === "ONE_WAY"
                  ? role === "Tôi dạy"
                    ? ("me" as const)
                    : ("partner" as const)
                  : undefined;
              const rolesChanged =
                path.type !== type || path.teacher !== teacher;
              save({
                ...path,
                type,
                teacher,
                credit: v.credit!,
                version: path.version + 1,
                meVersion: undefined,
                partnerVersion: undefined,
                plans: rolesChanged
                  ? []
                  : path.plans.map((p) => ({ ...p, schedule: undefined })),
              });
              router.replace(`/paths/${id}`);
            }}
          />
          <Copy muted>
            Điều khoản mới xóa xác nhận chung và lịch chưa khóa. Đổi hình thức
            hoặc vai trò yêu cầu hai bên tự tạo kế hoạch phù hợp lại.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
