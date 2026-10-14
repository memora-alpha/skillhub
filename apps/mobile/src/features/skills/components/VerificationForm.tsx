import { useEffect, useImperativeHandle, type Ref } from "react";
import { Text, View } from "react-native";
import { SkillsLayout, skillStyles } from "./SkillsLayout";
import { useVerificationForm } from "../hooks/use-verification-form";
import { VerificationFields } from "./VerificationFields";
import { formStyles } from "./skill-form-styles";
import type { Verification } from "../types/skills";

export type VerificationFormHandle = {
  locked: () => boolean;
  preserveDraft: (id: string) => void;
  hasFiles: () => boolean;
  valid: () => boolean;
  submitForSkill: (id: string) => Promise<Verification>;
};
export function VerificationForm({
  id,
  name,
  blocked,
  embedded = false,
  disabled = false,
  onBusyChange,
  saveWithSkill = false,
  onDraftChange,
  ref,
}: {
  id?: string;
  name?: string;
  blocked: boolean;
  embedded?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  saveWithSkill?: boolean;
  onDraftChange?: (state: { hasFiles: boolean; valid: boolean }) => void;
  ref?: Ref<VerificationFormHandle>;
}) {
  const model = useVerificationForm(id, blocked, disabled);
  useImperativeHandle(ref, () => ({
    locked: model.localLocked,
    preserveDraft: model.preserveDraft,
    hasFiles: () => !!model.draft.files.length,
    valid: () => !model.titleInvalid && !model.descriptionInvalid,
    submitForSkill: model.submitForSkill,
  }));
  useEffect(() => {
    onBusyChange?.(model.localBusy);
  }, [model.localBusy, onBusyChange]);
  const hasFiles = !!model.draft.files.length;
  useEffect(() => {
    onDraftChange?.({
      hasFiles,
      valid: !hasFiles || (!model.titleInvalid && !model.descriptionInvalid),
    });
  }, [hasFiles, model.titleInvalid, model.descriptionInvalid, onDraftChange]);
  const content = (
    <View style={[formStyles.section, { padding: 14, gap: 12 }]}>
      <View style={formStyles.sectionHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={formStyles.sectionHeading}>Bằng chứng xác minh</Text>
          <Text style={skillStyles.caption}>
            {embedded ? "Không bắt buộc" : name}
          </Text>
        </View>
      </View>
      {blocked && !model.submittedId && (
        <Text style={skillStyles.caption}>
          Yêu cầu xác minh đang chờ duyệt.
        </Text>
      )}
      {!model.submittedId && !blocked && (
        <VerificationFields
          model={model}
          saved={!!id}
          saveWithSkill={saveWithSkill}
        />
      )}
    </View>
  );
  return embedded ? (
    content
  ) : (
    <SkillsLayout title="Gửi bằng chứng" locked={model.locked}>
      {content}
    </SkillsLayout>
  );
}
