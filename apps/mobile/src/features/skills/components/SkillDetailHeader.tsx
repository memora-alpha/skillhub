import { Text, View } from "react-native";
import type { useOwnSkill } from "../hooks/use-skill-queries";
import type { OwnSkill } from "../types/skills";
import { skillStyles } from "./SkillsLayout";
import { SkillCard } from "./SkillCard";
import { SkillAction } from "./SkillAction";
import { SkillDetailActions } from "./SkillDetailActions";
import { QueryFeedback } from "./QueryFeedback";

export function SkillDetailHeader({
  skill,
  query,
  pending,
  waiting,
  onRefresh,
  onEdit,
  onVisibility,
  onVerify,
  onDelete,
}: Readonly<{
  skill: OwnSkill;
  query: ReturnType<typeof useOwnSkill>;
  pending: boolean;
  waiting: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onVisibility: () => void;
  onVerify: (waiting: boolean) => void;
  onDelete: () => void;
}>) {
  return (
    <View style={{ gap: 12 }}>
      <View style={skillStyles.row}>
        <Text style={[skillStyles.caption, { flex: 1 }]}>
          Thông tin kỹ năng
        </Text>
        <SkillAction
          label="Làm mới"
          icon="clock"
          disabled={pending || query.isFetching}
          onPress={onRefresh}
        />
      </View>
      <SkillCard skill={skill} detail />
      {!!query.error && <QueryFeedback query={query} />}
      <SkillDetailActions
        skill={skill}
        waiting={waiting}
        pending={pending}
        onEdit={onEdit}
        onVisibility={onVisibility}
        onVerify={() => onVerify(waiting)}
        onDelete={onDelete}
      />
    </View>
  );
}
