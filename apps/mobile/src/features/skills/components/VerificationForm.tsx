import { useEffect, useImperativeHandle, type Ref } from "react";
import { Text, View } from "react-native";
import { SkillsLayout, skillStyles } from "./SkillsLayout";
import { useVerificationForm } from "../hooks/use-verification-form";
import { VerificationFields } from "./VerificationFields";
import { formStyles } from "./skill-form-styles";
import { evidenceProgress } from "../utils/evidence-progress";

export type VerificationFormHandle = {
  locked: () => boolean;
  preserveDraft: (id: string) => void;
  hasFiles: () => boolean;
  valid: () => boolean;
  queueForSkill: (id: string) => boolean;
};
export function VerificationForm({
  id,
  name,
  blocked,
  embedded = false,
  disabled = false,
  onBusyChange,
  onProgressChange,
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
  onProgressChange?: (progress: string | null) => void;
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
    queueForSkill: model.queueForSkill,
  }));
  useEffect(() => {
    onBusyChange?.(model.localBusy);
  }, [model.localBusy, onBusyChange]);
  const progress = model.preparing
    ? (model.progress ?? evidenceProgress(model.draft.files))
    : null;
  useEffect(() => {
    onProgressChange?.(progress);
  }, [progress, onProgressChange]);
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
      {(blocked || model.submittedId) && (
        <Text style={skillStyles.caption}>Chờ duyệt</Text>
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
