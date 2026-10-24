import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { RequestTextField } from "./request-text-field";
import { ChoiceGroup } from "@/components/choice-group";
import { RequestSection as Panel } from "./request-section";
import { SkillSelector } from "./skill-selector";
import { RequestTimeFields } from "./request-time-fields";
import { RequestTagFields } from "./request-tag-fields";
import { RequestOfferingFields } from "./request-offering-fields";
import { requestLevels, type OwnerRequest } from "../types";
import type { RequestDraft } from "../schemas/request-form";
export function RequestFields({
  form,
  pending,
  initial,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  pending: boolean;
  initial?: OwnerRequest;
}>) {
  return (
    <View
      pointerEvents={pending ? "none" : "auto"}
      accessibilityState={{ disabled: pending }}
      style={{ gap: 16 }}
    >
      <Panel title="Nhu cầu học" icon="book">
        <RequestTextField
          form={form}
          name="title"
          label="Tiêu đề"
          required
          disabled={pending}
          placeholder="Ví dụ: Muốn học React Hooks để làm dự án web"
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
        <RequestTextField
          form={form}
          name="description"
          label="Mô tả nhu cầu"
          required
          multiline
          disabled={pending}
          placeholder="Bạn đang ở đâu, cần hỗ trợ gì và thích học theo cách nào?"
          hint="20–3000 ký tự."
        />
        <RequestTextField
          form={form}
          name="learningGoal"
          label="Mục tiêu học tập"
          required
          multiline
          disabled={pending}
          placeholder="Ví dụ: Tự hoàn thành một ứng dụng web sau 2 tháng"
          hint="10–1000 ký tự."
        />
      </Panel>
      <RequestOfferingFields form={form} disabled={pending} initial={initial} />
      <Panel title="Tùy chọn học tập" icon="filter" tone="amber">
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
        <RequestTagFields form={form} disabled={pending} />
        <RequestTextField
          form={form}
          name="desiredCreditPerHour"
          label="Credit mong muốn mỗi giờ (không bắt buộc)"
          keyboardType="decimal-pad"
          disabled={pending}
          placeholder="Ví dụ: 50.00"
          hint="Mức mong muốn; giá cuối cùng sẽ được thỏa thuận."
        />
      </Panel>
      <RequestTimeFields form={form} disabled={pending} />
    </View>
  );
}
