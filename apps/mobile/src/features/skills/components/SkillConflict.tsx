import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import type { OwnSkill } from "../types/skills";
import { formStyles } from "./skill-form-styles";
import { skillStyles } from "./SkillsLayout";

export function SkillConflict({
  latest,
  pending,
  onAccept,
}: {
  latest: OwnSkill;
  pending: boolean;
  onAccept: () => void;
}) {
  return (
    <View style={formStyles.section}>
      <Text style={formStyles.sectionHeading}>
        Bản đã lưu: phiên bản {latest.version}
      </Text>
      <Text style={skillStyles.body}>{latest.description}</Text>
      <Text style={skillStyles.caption}>
        {latest.archivedAt
          ? "Kỹ năng đã bị xóa khỏi hồ sơ."
          : "So sánh bản đã lưu với nội dung đang nhập trước khi tiếp tục."}
      </Text>
      <Button
        disabled={pending || !!latest.archivedAt}
        variant="secondary"
        onPress={onAccept}
      >
        Dùng phiên bản mới, giữ nội dung đang nhập
      </Button>
    </View>
  );
}
