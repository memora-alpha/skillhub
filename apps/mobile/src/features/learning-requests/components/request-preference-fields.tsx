import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { Host, Switch } from "@expo/ui";
import { ChoiceGroup } from "@/components/choice-group";
import { uiLabel } from "@/constants/ui-copy";
import { RequestSection } from "./request-section";
import { RequestTagFields } from "./request-tag-fields";
import { RequestTextField } from "./request-text-field";
import { requestLevels } from "../types";
import type { RequestDraft } from "../schemas/request-form";

export function RequestPreferenceFields({
  form,
  disabled,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}>) {
  const [level, verified, credit, ids, proposals, tagSearch] = useWatch({
    control: form.control,
    name: [
      "currentLevel",
      "verifiedTeacherOnly",
      "desiredCreditPerHour",
      "tagIds",
      "proposedTags",
      "tagSearch",
    ],
  });
  const count = ids.length + proposals.length;
  const summary =
    [
      level && uiLabel(level),
      count > 0 && `${count} tag`,
      credit && `${credit} Credit/giờ`,
      verified === "Có" && "Người dạy đã xác minh",
      tagSearch.trim() && "Tag đang nhập",
    ]
      .filter(Boolean)
      .join(" · ") || "Trình độ, tag, mức Credit";
  const hasError = [
    "currentLevel",
    "verifiedTeacherOnly",
    "desiredCreditPerHour",
    "tagIds",
    "proposedTags",
    "tagSearch",
  ].some((name) => name in form.formState.errors);
  return (
    <RequestSection
      title="Tùy chọn học tập"
      icon="filter"
      tone="amber"
      compact
      collapsible
      summary={summary}
      hasError={hasError}
      disabled={disabled}
    >
      <Controller
        control={form.control}
        name="currentLevel"
        render={({ field }) => (
          <ChoiceGroup
            label="Trình độ hiện tại"
            disabled={disabled}
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
          <Host
            colorScheme="light"
            matchContents={{ vertical: true }}
            style={{ width: "100%", minHeight: 48 }}
          >
            <Switch
              label="Chỉ nhận người dạy đã xác minh kỹ năng"
              value={field.value === "Có"}
              disabled={disabled}
              onValueChange={(value) => field.onChange(value ? "Có" : "Không")}
            />
          </Host>
        )}
      />
      <RequestTagFields form={form} disabled={disabled} />
      <RequestTextField
        form={form}
        name="desiredCreditPerHour"
        label="Credit mong muốn / giờ"
        keyboardType="decimal-pad"
        disabled={disabled}
        placeholder="Ví dụ: 50.00"
        hint="Giá cuối cùng sẽ được thỏa thuận."
      />
    </RequestSection>
  );
}
