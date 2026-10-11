import { Text, View } from "react-native";
import type { UseFormReturn } from "react-hook-form";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import { appColors } from "@/constants/theme";
import type { SkillFormValues } from "../schemas/skill-form";
import type { OwnSkill, CatalogSkill } from "../types/skills";
import { CatalogPicker } from "./CatalogPicker";
import { SkillFormFields } from "./SkillFormFields";
import { skillStyles } from "./SkillsLayout";
import { formStyles } from "./skill-form-styles";

export function SkillEditorFields({
  baseline,
  selected,
  form,
  disabled,
  onSelect,
}: {
  baseline?: OwnSkill;
  selected?: CatalogSkill;
  form: UseFormReturn<SkillFormValues>;
  disabled: boolean;
  onSelect: (skill: CatalogSkill) => void;
}) {
  return (
    <View style={formStyles.section}>
      <View style={formStyles.sectionHeader}>
        <View style={formStyles.icon}>
          <Icon name="book" size={20} color={appColors.primary} />
        </View>
        <Text style={formStyles.sectionHeading}>Thông tin kỹ năng</Text>
      </View>
      {baseline ? (
        <View style={formStyles.selector}>
          <Icon name="book" size={20} color={appColors.primary} />
          <Text style={skillStyles.heading}>{baseline.skill.name}</Text>
        </View>
      ) : (
        <CatalogPicker
          selected={selected}
          disabled={disabled}
          onSelect={onSelect}
        />
      )}
      {!!form.formState.errors.skillId && (
        <FormNotice tone="error">
          {form.formState.errors.skillId.message}
        </FormNotice>
      )}
      <SkillFormFields
        form={form}
        disabled={disabled || !!baseline?.archivedAt}
      />
    </View>
  );
}
