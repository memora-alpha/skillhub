import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { DataForm, textRule, integerRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { usePathsPreview } from "../context";
import { editOwnPlan } from "../rules";
import { uuid } from "@/lib/http/contracts";
import { ApiPlanDetailScreen, ApiPlanEditorScreen } from "./ApiPlanScreens";
export function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuid.safeParse(id).success ? (
    <ApiPlanDetailScreen />
  ) : (
    <PreviewPlanDetailScreen />
  );
}
function PreviewPlanDetailScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  const plan = path?.plans.find((p) => p.id === planId);
  return (
    <FeaturePage title="Kế hoạch học tập" back={`/paths/${id}`}>
      {!path || !plan ? (
        <EmptyState
          title="Không tìm thấy kế hoạch"
          description="Kiểm tra lại lộ trình đã chọn."
        />
      ) : (
        <>
          <Panel title={`${plan.skill} · v${plan.version}`}>
            <Copy>
              {plan.teacher === "me" ? "Bạn là người dạy" : "Bạn là người học"}
            </Copy>
            <Copy>{plan.goal}</Copy>
            {plan.outline.map((lesson, i) => (
              <Copy key={i}>
                Buổi {i + 1}: {lesson}
              </Copy>
            ))}
            <Copy muted>
              {plan.learnerVersion === plan.version
                ? "Người học đã xác nhận phiên bản hiện tại."
                : "Đang chờ xác nhận phiên bản hiện tại."}
            </Copy>
            {plan.revision && (
              <FormNotice tone="info">
                Yêu cầu chỉnh sửa: {plan.revision}
              </FormNotice>
            )}
          </Panel>
          {path.status === "PROPOSED" &&
            (plan.teacher === "me" ? (
              <RouteButton href={`/paths/${id}/plans/${planId}/edit`}>
                Sửa kế hoạch tôi dạy
              </RouteButton>
            ) : (
              <>
                <Button
                  variant="craft"
                  disabled={plan.learnerVersion === plan.version}
                  onPress={() =>
                    save({
                      ...path,
                      plans: path.plans.map((p) =>
                        p.id === planId
                          ? {
                              ...p,
                              learnerVersion: p.version,
                              revision: undefined,
                            }
                          : p,
                      ),
                    })
                  }
                >
                  Xác nhận kế hoạch v{plan.version}
                </Button>
                <Panel title="Đề nghị người dạy chỉnh sửa">
                  <DataForm
                    fields={[
                      {
                        name: "reason",
                        label: "Nội dung muốn điều chỉnh",
                        rule: textRule(10, 1000),
                        multiline: true,
                      },
                    ]}
                    submitLabel="Gửi yêu cầu chỉnh sửa mẫu"
                    onSubmit={(v) =>
                      save({
                        ...path,
                        meVersion: undefined,
                        partnerVersion: undefined,
                        plans: path.plans.map((p) =>
                          p.id === planId
                            ? {
                                ...p,
                                learnerVersion: undefined,
                                revision: v.reason,
                                schedule: undefined,
                              }
                            : { ...p, schedule: undefined },
                        ),
                      })
                    }
                  />
                </Panel>
              </>
            ))}
          <Copy muted>
            Chỉ người dạy tạo và sửa kế hoạch. Chỉnh sửa làm tăng phiên bản và
            cần người học xác nhận lại.
          </Copy>
        </>
      )}
    </FeaturePage>
  );
}
export function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuid.safeParse(id).success ? (
    <ApiPlanEditorScreen />
  ) : (
    <PreviewPlanEditorScreen />
  );
}
function PreviewPlanEditorScreen() {
  const { id, planId } = useLocalSearchParams<{
    id: string;
    planId?: string;
  }>();
  const { paths, save } = usePathsPreview();
  const router = useRouter();
  const path = paths.find((p) => p.id === id);
  const plan = path?.plans.find((p) => p.id === planId);
  const canEdit =
    path?.status === "PROPOSED" &&
    (plan
      ? plan.teacher === "me"
      : !path.plans.some((p) => p.teacher === "me") &&
        (path.type === "TWO_WAY" || path.teacher === "me"));
  return (
    <FeaturePage
      title={plan ? "Sửa kế hoạch tôi dạy" : "Tạo kế hoạch tôi dạy"}
      back={`/paths/${id}`}
    >
      {!path || !canEdit ? (
        <EmptyState
          title="Không thể sửa kế hoạch này"
          description="Bạn chỉ tạo hoặc sửa kế hoạch mình dạy khi lộ trình còn thương lượng."
        />
      ) : (
        <Panel title="Thiết kế hành trình học">
          <DataForm
            defaults={{
              skill: plan?.skill ?? "React",
              goal: plan?.goal ?? "",
              count: String(plan?.outline.length ?? 2),
              outline: plan?.outline.join("\n") ?? "",
            }}
            fields={[
              {
                name: "skill",
                label: "Kỹ năng bạn dạy",
                rule: textRule(1, 100),
                choices: [
                  "React",
                  "TypeScript",
                  "JavaScript",
                  "UI/UX",
                  "Tiếng Anh",
                  "Guitar",
                  "Nhiếp ảnh",
                ],
              },
              {
                name: "goal",
                label: "Mục tiêu kế hoạch",
                rule: textRule(10, 1500),
                multiline: true,
              },
              {
                name: "count",
                label: "Số buổi",
                rule: integerRule(1),
                numeric: true,
              },
              {
                name: "outline",
                label: "Nội dung từng buổi",
                rule: textRule(10, 3000),
                multiline: true,
                hint: "Mỗi dòng là một buổi. Số dòng phải khớp số buổi.",
              },
            ]}
            submitLabel="Gửi kế hoạch mẫu"
            onSubmit={(v) => {
              const outline = v
                .outline!.split("\n")
                .map((s) => s.trim())
                .filter(Boolean);
              if (outline.length !== Number(v.count))
                return "Số dòng nội dung phải khớp số buổi.";
              if (outline.some((s) => s.length < 5))
                return "Mô tả rõ nội dung của từng buổi.";
              const key = plan?.id ?? `plan-${Date.now()}`;
              if (plan) {
                const next = editOwnPlan(path, key, {
                  skill: v.skill!,
                  goal: v.goal!,
                  outline,
                });
                if (next) save(next);
              } else
                save({
                  ...path,
                  version: path.version + 1,
                  meVersion: undefined,
                  partnerVersion: undefined,
                  plans: [
                    ...path.plans.map((p) => ({ ...p, schedule: undefined })),
                    {
                      id: key,
                      teacher: "me",
                      learner: "partner",
                      skill: v.skill!,
                      goal: v.goal!,
                      outline,
                      version: 1,
                    },
                  ],
                });
              router.replace(`/paths/${id}/plans/${key}`);
            }}
          />
          <Copy muted>
            Kế hoạch chỉ gửi cho chiều bạn dạy. Người trao đổi tự xác nhận bằng
            tài khoản của họ.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
