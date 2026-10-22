import { useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "@/components/feature-page";
import { FlowSection as Panel } from "@/components/learning-flow";
import { Button } from "@/components/Button";
import {
  ConnectionFeedback,
  useConnectionCommand,
  useCatalogName,
} from "@/features/connections";
import { useSkillOptions } from "@/features/learning-requests";
import { useLearningPathsApi } from "../hooks/use-learning-paths-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  planEditorSchema,
  planEditorInput,
  type PlanEditorValues,
} from "../schemas/plan-editor-input";
import {
  PlanEditorFrame,
  PlanSkillPicker,
  PlanGoalField,
} from "./plan-editor-fields";
import { PlanOutlineEditor } from "./plan-outline-editor";

export function PlanForm({
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
  const options = skills.data?.pages.flatMap((page) => page.items) ?? [];
  const { control, watch, setValue, handleSubmit, formState } =
    useForm<PlanEditorValues>({
      resolver: zodResolver(planEditorSchema),
      defaultValues: {
        skillId: plan?.skillId ?? "",
        learningGoal: plan?.learningGoal ?? "",
        sessionOutline: plan?.sessionOutline.map(({ content }) => ({
          content,
        })) ?? [{ content: "" }],
      },
    });
  const skillId = watch("skillId");
  const pending = command.pending || command.uncertain || blocked;
  const selectedSkill = useCatalogName(
    options.some((option) => option.id === skillId) ? undefined : skillId,
  );
  const saveAction = (
    <Button
      variant="craft"
      disabled={pending}
      onPress={() => {
        if (pending) return;
        void handleSubmit(async (values) => {
          const input = planEditorInput(values);
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
          if (result) router.dismissTo(`/paths/${path.id}/plans/${result.id}`);
        })();
      }}
    >
      {command.pending ? "Đang lưu..." : "Lưu và xem lộ trình"}
    </Button>
  );
  return (
    <PlanEditorFrame action={saveAction}>
      {(skills.isLoading || skills.error) && (
        <ConnectionFeedback
          loading={skills.isLoading}
          error={skills.error}
          retry={skills.refetch}
        />
      )}
      <PlanSkillPicker
        options={options}
        value={skillId}
        selectedName={selectedSkill.data}
        hasMore={skills.hasNextPage}
        loadingMore={skills.isFetchingNextPage}
        onLoadMore={() => {
          void skills.fetchNextPage();
        }}
        disabled={pending}
        onChange={(id) => {
          if (!pending)
            setValue("skillId", id, {
              shouldValidate: true,
              shouldDirty: true,
            });
        }}
      />
      {formState.errors.skillId && (
        <Copy>{formState.errors.skillId.message}</Copy>
      )}
      {!skills.isLoading && !skills.error && !options.length && (
        <Copy muted>Chưa có kỹ năng trong danh mục.</Copy>
      )}
      <PlanGoalField control={control} disabled={pending} />
      <PlanOutlineEditor
        control={control}
        disabled={pending}
        error={
          formState.errors.sessionOutline?.root?.message ??
          formState.errors.sessionOutline?.message
        }
      />
      {plan && (
        <Copy muted>
          Nếu nội dung thay đổi, người học cần xác nhận lại lộ trình. Cách học
          đã thống nhất được giữ.
        </Copy>
      )}
      {!!command.error && <ConnectionFeedback error={command.error} />}
      {command.uncertain && (
        <Panel title="Kiểm tra kế hoạch vừa gửi">
          <Copy>
            Chưa xác định được kết quả. Nội dung được giữ lại; mở lộ trình để
            xem kế hoạch và phiên bản mới nhất trước khi gửi thêm.
          </Copy>
          <Button
            variant="secondary"
            onPress={() => router.dismissTo(`/paths/${path.id}`)}
          >
            Xem trạng thái lộ trình
          </Button>
        </Panel>
      )}
    </PlanEditorFrame>
  );
}
