import { PathReadFeedback } from "../components/PathReadFeedback";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { useSkillOptions } from "@/features/learning-requests";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import { canCreatePlan, editablePath } from "../policy-api";
import { ApiPlanPanel } from "../components/ApiPlanPanel";
import { JourneyProgress } from "../components/LearningJourney";

const schema = z.object({
  skillId: z.uuid("Chọn kỹ năng trong danh mục."),
  learningGoal: z.string().trim().min(1, "Nhập mục tiêu học.").max(1500),
  outline: z
    .string()
    .trim()
    .min(1, "Nhập nội dung từng buổi.")
    .refine((v) => {
      const lines = v.split("\n");
      return (
        lines.length <= 100 &&
        lines.every((s) => s.trim().length > 0 && s.trim().length <= 2000)
      );
    }, "Mỗi dòng là một buổi, không để trống, tối đa 100 buổi và 2.000 ký tự/buổi."),
});
type Values = z.infer<typeof schema>;
export function ApiPlanDetailScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const query = useLearningPath(id),
    plan = query.data?.plans.find((p) => p.id === planId);
  return (
    <FeaturePage title="Nội dung học" demo={false} back={`/paths/${id}`}>
      <JourneyProgress step={2} />
      <PathReadFeedback query={query} />
      {query.data && plan && (
        <ApiPlanPanel
          path={query.data}
          plan={plan}
          blocked={!!query.error || query.isFetching}
        />
      )}
      {query.data && !plan && (
        <EmptyState
          title="Kế hoạch không thuộc phiên bản hiện tại"
          description="Quay về Learning Path và chọn kế hoạch đang áp dụng."
        />
      )}
    </FeaturePage>
  );
}
export function ApiPlanEditorScreen() {
  const { id, planId } = useLocalSearchParams<{
    id: string;
    planId?: string;
  }>();
  const query = useLearningPath(id),
    runtime = useConnections();
  const path = query.data,
    plan = path?.plans.find((p) => p.id === planId);
  const allowed =
    path &&
    !query.error &&
    (planId
      ? plan && editablePath(path) && plan.teacherId === runtime.userId
      : canCreatePlan(path, runtime.userId));
  return (
    <FeaturePage
      title={planId ? "Chỉnh nội dung bạn dạy" : "Bạn sẽ dạy những gì?"}
      demo={false}
      back={`/paths/${id}`}
    >
      <JourneyProgress step={2} />
      <PathReadFeedback query={query} />
      {allowed && path && (
        <PlanForm
          key={`${path.currentVersion}:${plan?.version ?? "new"}`}
          path={path}
          plan={plan}
          blocked={query.isFetching}
        />
      )}
      {path && !allowed && (
        <EmptyState
          title="Không thể sửa kế hoạch này"
          description="Bạn chỉ tạo hoặc sửa kế hoạch mình dạy khi Learning Path chưa khóa."
        />
      )}
    </FeaturePage>
  );
}
function PlanForm({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan?: ApiLearningPlan;
  blocked: boolean;
}>) {
  const api = useLearningPathsApi(),
    command = useConnectionCommand(),
    router = useRouter();
  const skills = useSkillOptions();
  const options = skills.data?.pages.flatMap((p) => p.items) ?? [];
  const { control, watch, setValue, handleSubmit, formState } = useForm<Values>(
    {
      resolver: zodResolver(schema),
      defaultValues: {
        skillId: plan?.skillId ?? "",
        learningGoal: plan?.learningGoal ?? "",
        outline: plan?.sessionOutline.map((s) => s.content).join("\n") ?? "",
      },
    },
  );
  const skillId = watch("skillId"),
    pending = command.pending || command.uncertain || blocked;
  return (
    <Panel title="Nội dung bạn gửi cho người trao đổi">
      <Copy>
        Chỉ soạn phần bạn dạy. Người trao đổi sẽ xem và đồng ý trước khi hai bạn
        chọn lịch.
      </Copy>
      <ConnectionFeedback
        loading={skills.isLoading}
        error={skills.error}
        retry={skills.refetch}
      />
      <ChoiceGroup
        label="Kỹ năng bạn dạy"
        options={options.map((s) => s.name)}
        value={options.find((s) => s.id === skillId)?.name ?? ""}
        onChange={(name) => {
          const id = options.find((s) => s.name === name)?.id;
          if (id && !pending) setValue("skillId", id, { shouldValidate: true });
        }}
      />
      {formState.errors.skillId && (
        <Copy>{formState.errors.skillId.message}</Copy>
      )}
      {skills.hasNextPage && (
        <Button
          variant="secondary"
          disabled={skills.isFetchingNextPage}
          onPress={() => {
            void skills.fetchNextPage();
          }}
        >
          Thêm kỹ năng
        </Button>
      )}
      <ControlledInput
        control={control}
        name="learningGoal"
        label="Mục tiêu học"
        multiline
        maxLength={1500}
        editable={!pending}
      />
      <ControlledInput
        control={control}
        name="outline"
        label="Nội dung từng buổi"
        multiline
        hint="Mỗi dòng là một buổi, tối đa 100 buổi."
        editable={!pending}
      />
      <Copy>
        {watch("outline").trim()
          ? watch("outline").trim().split("\n").length
          : 0}{" "}
        buổi
      </Copy>
      {plan && (
        <Copy muted>
          Sửa kế hoạch làm tăng phiên bản kế hoạch và điều khoản chung. Cần xác
          nhận lại và đề xuất lại lịch.
        </Copy>
      )}
      <ConnectionFeedback error={command.error} />
      {command.uncertain && (
        <Button
          variant="paper"
          disabled={blocked || command.pending}
          onPress={() => {
            void command.retry().then((result) => {
              if (result) router.replace(`/paths/${path.id}`);
            });
          }}
        >
          Kiểm tra lại nội dung vừa gửi
        </Button>
      )}
      <Button
        disabled={pending}
        onPress={() => {
          void handleSubmit(async (values) => {
            const sessionOutline = values.outline
              .split("\n")
              .map((content) => ({ content: content.trim() }));
            const input = {
              skillId: values.skillId,
              learningGoal: values.learningGoal,
              totalSessions: sessionOutline.length,
              sessionOutline,
            };
            const result = await command.run(
              JSON.stringify({
                path: path.id,
                plan: plan?.id,
                version: plan?.version,
                input,
              }),
              () =>
                plan
                  ? api.revisePlan(plan.id, input, plan.version)
                  : api.addPlan(path.id, input),
            );
            if (result) router.replace(`/paths/${path.id}`);
          })();
        }}
      >
        {command.pending ? "Đang gửi..." : "Gửi nội dung cho người trao đổi"}
      </Button>
    </Panel>
  );
}
