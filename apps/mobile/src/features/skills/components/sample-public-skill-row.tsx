import { useState } from "react";
import { Text } from "react-native";
import { InfoModal } from "@/components/InfoModal";
import type { SkillBadge } from "../types/skills";
import { ProfileSkillRow } from "./ProfileSkillRows";
import { skillStyles } from "./SkillsLayout";

export function SamplePublicSkillRow({
  name,
  level,
  status,
  description,
  experienceYears,
}: {
  name: string;
  level: string;
  status: SkillBadge;
  description?: string;
  experienceYears?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProfileSkillRow
        name={name}
        level={level}
        status={status}
        onPress={() => setOpen(true)}
      />
      <InfoModal
        title={open ? "Chi tiết kỹ năng" : null}
        onClose={() => setOpen(false)}
      >
        <Text style={skillStyles.caption}>Kỹ năng công khai · dữ liệu mẫu</Text>
        <ProfileSkillRow name={name} level={level} status={status} />
        <Text selectable style={skillStyles.body}>
          {description || "Chưa có mô tả kỹ năng."}
        </Text>
        {experienceYears != null && (
          <Text style={skillStyles.caption}>
            {experienceYears} năm kinh nghiệm · tự khai
          </Text>
        )}
      </InfoModal>
    </>
  );
}
