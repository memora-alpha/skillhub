import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import { useSkills } from "../context/SkillsProvider";
import { useSkillAction } from "../hooks/use-skill-action";
import { skillLevelLabel } from "../utils/skill-level";
import { skillError, outcomeUnknown } from "../utils/skill-errors";
import type { OwnSkill } from "../types/skills";
import { VerificationBadge } from "./VerificationBadge";
import { skillStyles } from "./SkillsLayout";

export function ArchivedSkillCard({
  skill,
  canRead,
  reading,
  onRefresh,
}: Readonly<{
  skill: OwnSkill;
  canRead: () => boolean;
  reading: boolean;
  onRefresh: () => Promise<unknown>;
}>) {
  const { api, rememberRestoredSkill } = useSkills();
  const action = useSkillAction({ canAct: canRead });
  const [confirm, setConfirm] = useState(false);
  const disabled = reading || action.pending || !canRead();
  const restore = () => {
    setConfirm(false);
    void action.run(
      `restore:${skill.id}`,
      { expectedVersion: skill.version },
      async (key) => {
        const saved = await api.restore(skill.id, skill.version, key);
        if (action.current()) await rememberRestoredSkill(saved);
        return saved;
      },
      undefined,
      true,
      "Đã khôi phục kỹ năng.",
    );
  };
  return (
    <View style={skillStyles.card}>
      <Text accessibilityRole="header" style={skillStyles.heading}>
        {skill.skill.name}
      </Text>
      <Text style={skillStyles.caption}>{skillLevelLabel(skill)}</Text>
      <VerificationBadge status={skill.verificationStatus} />
      <Text style={skillStyles.body}>{skill.description}</Text>
      <Text style={skillStyles.caption}>
        Đã lưu trữ ·{" "}
        {skill.isVisible
          ? "Hiển thị sau khi khôi phục"
          : "Vẫn ẩn sau khi khôi phục"}
      </Text>
      {skill.skill.status !== "ACTIVE" && (
        <FormNotice tone="info">
          Kỹ năng trong danh mục đang tạm ngưng. Chỉ khôi phục khi danh mục hoạt
          động trở lại.
        </FormNotice>
      )}
      {!!action.error && (
        <FormNotice tone="error">{skillError(action.error, true)}</FormNotice>
      )}
      {outcomeUnknown(action.error) && (
        <Button
          variant="secondary"
          disabled={disabled}
          onPress={() => void onRefresh()}
        >
          Kiểm tra lại danh sách
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={disabled || skill.skill.status !== "ACTIVE"}
        onPress={() => setConfirm(true)}
      >
        {action.pending ? "Đang khôi phục…" : "Khôi phục kỹ năng"}
      </Button>
      <InfoModal
        title={confirm ? `Khôi phục ${skill.skill.name}?` : null}
        onClose={() => setConfirm(false)}
        confirmLabel="Khôi phục"
        onConfirm={() => {
          if (!disabled) restore();
        }}
      >
        <Text style={skillStyles.body}>
          Kỹ năng trở lại danh sách của bạn, giữ nguyên lịch sử xác minh và lựa
          chọn hiển thị đã lưu.
        </Text>
        <Button variant="secondary" onPress={() => setConfirm(false)}>
          Hủy
        </Button>
      </InfoModal>
    </View>
  );
}
