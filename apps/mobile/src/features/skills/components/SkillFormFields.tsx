import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { ControlledInput } from "@/components/ControlledInput";
import { skillLevels, levelLabels } from "../types/skills";
import type { SkillFormValues } from "../schemas/skill-form";
import { formStyles } from "./skill-form-styles";
import { SkillLevelGuide } from "./skill-level-guide";
export function SkillFormFields({
  form,
  disabled,
}: {
  form: UseFormReturn<SkillFormValues>;
  disabled: boolean;
}) {
  return (
    <View style={{ gap: 18 }}>
      <Text style={formStyles.label}>Trình độ của bạn</Text>
      <Controller
        control={form.control}
        name="level"
        render={({ field }) => (
          <View style={{ gap: 12 }}>
            <View style={formStyles.options}>
              {skillLevels.map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityLabel={levelLabels[level]}
                  accessibilityState={{
                    checked: field.value === level,
                    disabled,
                  }}
                  disabled={disabled}
                  style={[
                    formStyles.option,
                    field.value === level && formStyles.selected,
                    disabled && { opacity: 0.6 },
                  ]}
                  onPress={() => field.onChange(level)}
                >
                  <Text
                    style={[
                      formStyles.label,
                      field.value === level && formStyles.selectedText,
                    ]}
                  >
                    {levelLabels[level]}
                  </Text>
                  {field.value === level && (
                    <Icon
                      name="check-circle"
                      size={16}
                      color={appColors.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
            <SkillLevelGuide level={field.value} />
          </View>
        )}
      />
      <ControlledInput
        control={form.control}
        name="description"
        label="Mô tả kinh nghiệm"
        placeholder="Kinh nghiệm hoặc dự án bạn đã thực hiện"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        required
        editable={!disabled}
      />
      <ControlledInput
        control={form.control}
        name="experienceYears"
        label="Số năm kinh nghiệm (tùy chọn)"
        placeholder="Ví dụ: 2,5"
        keyboardType="decimal-pad"
        editable={!disabled}
      />
      <Controller
        control={form.control}
        name="isVisible"
        render={({ field }) => (
          <View style={{ gap: 10 }}>
            <Text style={formStyles.label}>Hiển thị trên hồ sơ</Text>
            <View style={formStyles.options}>
              {[true, false].map((visible) => (
                <Pressable
                  key={String(visible)}
                  accessibilityRole="radio"
                  accessibilityLabel={visible ? "Công khai" : "Riêng tư"}
                  accessibilityState={{
                    checked: field.value === visible,
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => field.onChange(visible)}
                  style={[
                    formStyles.option,
                    field.value === visible && formStyles.selected,
                    disabled && { opacity: 0.6 },
                  ]}
                >
                  <Icon
                    name={visible ? "eye" : "eye-off"}
                    size={16}
                    color={
                      field.value === visible
                        ? appColors.primary
                        : appColors.muted
                    }
                  />
                  <Text
                    style={[
                      formStyles.label,
                      field.value === visible && formStyles.selectedText,
                    ]}
                  >
                    {visible ? "Công khai" : "Riêng tư"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}
