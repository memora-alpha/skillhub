import { Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import type { Reputation } from "../api/community-api";
import { policyStyles as styles } from "./reputation-policy.styles";

const levels: Record<string, string> = {
  EXCELLENT: "Rất tốt",
  NORMAL: "Bình thường",
  WARNING: "Cảnh báo",
  RESTRICTED: "Hạn chế",
  LOW: "Thấp",
  SEVERE: "Rất thấp",
  CRITICAL: "Nghiêm trọng",
};

export function ReputationScoreCard({ data }: Readonly<{ data: Reputation }>) {
  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreInfo}>
        <Text style={styles.label}>Điểm uy tín hiện tại</Text>
        <Text style={styles.score}>
          {data.reputationScore}
          <Text style={styles.scoreTotal}> / 100</Text>
        </Text>
      </View>
      <Badge
        label={levels[data.level] ?? data.level}
        variant={data.activeRestrictions.length ? "warning" : "sage"}
      />
    </View>
  );
}
