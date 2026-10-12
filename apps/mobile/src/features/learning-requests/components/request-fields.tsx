import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { ControlledInput } from "@/components/ControlledInput";
import { ChoiceGroup } from "@/components/choice-group";
import { Copy } from "@/components/feature-page";
import { RequestSection as Panel } from "./request-section";
import { SkillSelector } from "./skill-selector";
import { RequestTimeFields } from "./request-time-fields";
import { requestLevels, type OwnerRequest } from "../types";
import type { RequestDraft } from "../schemas/request-form";
export function RequestFields({
  form,
  pending,
  initial,
}: {
  form: UseFormReturn<RequestDraft>;
  pending: boolean;
  initial?: OwnerRequest;
}) {
  return (
    <View
      pointerEvents={pending ? "none" : "auto"}
      accessibilityState={{ disabled: pending }}
      style={{ gap: 16 }}
    >
      <Panel title="Nhu cầu học">
        <ControlledInput
          control={form.control}
          name="title"
          label="Tiêu đề"
          required
          editable={!pending}
          placeholder="Bạn muốn học điều gì?"
        />
        <Controller
          control={form.control}
          name="skillId"
          render={({ field, fieldState }) => (
            <SkillSelector
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              locked={!!initial?.publishedAt}
              disabled={pending}
            />
          )}
        />
        <ControlledInput
          control={form.control}
          name="description"
          label="Mô tả nhu cầu"
          required
          multiline
          editable={!pending}
          hint="20–3000 ký tự."
        />
        <ControlledInput
          control={form.control}
          name="learningGoal"
          label="Mục tiêu học tập"
          required
          multiline
          editable={!pending}
          hint="10–1000 ký tự."
        />
      </Panel>
      <Panel title="Tùy chọn học tập">
        <Controller
          control={form.control}
          name="currentLevel"
          render={({ field }) => (
            <ChoiceGroup
              label="Trình độ hiện tại (không bắt buộc)"
              disabled={pending}
              options={["Chưa khai", ...requestLevels]}
              value={field.value || "Chưa khai"}
              onChange={(value) =>
                field.onChange(value === "Chưa khai" ? "" : value)
              }
            />
          )}
        />
        <Controller
          control={form.control}
          name="verifiedTeacherOnly"
          render={({ field }) => (
            <ChoiceGroup
              label="Chỉ nhận người dạy có kỹ năng đã xác minh"
              disabled={pending}
              options={["Không", "Có"]}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Copy muted>
          Chọn tag sẽ được bổ sung sau.
          {initial?.tagIds.length
            ? ` ${initial.tagIds.length} tag đã chọn được giữ nguyên.`
            : ""}
        </Copy>
        <RequestTimeFields form={form} disabled={pending} />
      </Panel>
    </View>
  );
}
