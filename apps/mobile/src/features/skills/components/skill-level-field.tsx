import { Controller, type UseFormReturn } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import { appColors } from "@/constants/theme";
import type { SkillFormValues } from "../schemas/skill-form";
import type { OwnSkill } from "../types/skills";
import type { useSkillLevels } from "../hooks/use-skill-levels";
import { skillLevelLabel } from "../utils/skill-level";
import { QueryFeedback } from "./QueryFeedback";
import { formStyles } from "./skill-form-styles";
import { skillStyles } from "./SkillsLayout";

export function SkillLevelField({
  form,
  query,
  baseline,
  disabled,
}: Readonly<{
  form: UseFormReturn<SkillFormValues>;
  query: ReturnType<typeof useSkillLevels>;
  baseline?: OwnSkill;
  disabled: boolean;
}>) {
  const skillId = form.watch("skillId");
  return (
    <View style={{ gap: 12 }}>
      <Text style={formStyles.label}>Trình độ của bạn</Text>
      {!skillId ? (
        <Text style={skillStyles.caption}>
          Chọn kỹ năng trước khi chọn trình độ.
        </Text>
      ) : (
        <>
          <QueryFeedback
            loadingPresentation="placeholder"
            query={query}
            empty={query.data?.length === 0}
            emptyText="Kỹ năng chưa có trình độ để chọn."
          />
          <Controller
            control={form.control}
            name="levelId"
            render={({ field }) => {
              const selected = query.data?.find(
                (level) => level.id === field.value,
              );
              const historical =
                baseline && field.value === baseline.levelId && !selected;
              return (
                <View style={{ gap: 12 }}>
                  {historical && (
                    <Text style={skillStyles.caption}>
                      Trình độ đã lưu: {skillLevelLabel(baseline)}. Có thể giữ
                      nguyên hoặc chọn trình độ khác.
                    </Text>
                  )}
                  {!!field.value && !selected && !historical && query.data && (
                    <FormNotice tone="error">
                      Trình độ không còn khả dụng. Hãy chọn lại.
                    </FormNotice>
                  )}
                  <View style={formStyles.options}>
                    {query.data?.map((level) => (
                      <Pressable
                        key={level.id}
                        accessibilityRole="radio"
                        accessibilityLabel={level.name}
                        aria-checked={field.value === level.id}
                        accessibilityState={{
                          checked: field.value === level.id,
                          disabled,
                        }}
                        disabled={disabled}
                        onPress={() =>
                          form.setValue("levelId", level.id, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }
                        style={[
                          formStyles.option,
                          field.value === level.id && formStyles.selected,
                          disabled && { opacity: 0.6 },
                        ]}
                      >
                        <Text
                          style={[
                            formStyles.label,
                            { flex: 1 },
                            field.value === level.id && formStyles.selectedText,
                          ]}
                        >
                          {level.name}
                        </Text>
                        {field.value === level.id && (
                          <Icon
                            name="check-circle"
                            size={16}
                            color={appColors.primary}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                  {!!selected?.description && (
                    <View style={formStyles.levelGuide}>
                      <Text style={skillStyles.body}>
                        {selected.description}
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        </>
      )}
      {!!form.formState.errors.levelId && (
        <FormNotice tone="error">
          {form.formState.errors.levelId.message}
        </FormNotice>
      )}
    </View>
  );
}
