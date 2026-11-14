import { Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { appColors as colors } from "@/constants/theme";
import type { Reputation } from "../api/community-api";
import { policyStyles as styles } from "./reputation-policy.styles";
import { reputationStyles as ui } from "./reputation.styles";
import {
  reputationLevels,
  reputationTone,
} from "../utils/reputation-presentation";

export function ReputationScoreCard({
  data,
  compact = false,
}: Readonly<{ data: Reputation; compact?: boolean }>) {
  const tone = reputationTone(data.level);
  return (
    <View style={compact ? styles.scoreCard : ui.card}>
      <View style={ui.row}>
        <View style={styles.scoreInfo}>
          <Text style={styles.label}>Điểm uy tín hiện tại</Text>
          <Text selectable style={compact ? styles.score : ui.number}>
            {data.reputationScore}
            <Text style={styles.scoreTotal}> / 100</Text>
          </Text>
        </View>
        <Badge
          label={reputationLevels[data.level] ?? "Chưa xác định"}
          variant={tone === "forest" ? "sage" : "warning"}
        />
      </View>
      {!compact && (
        <View
          accessible
          accessibilityLabel={`Điểm uy tín ${data.reputationScore} trên 100`}
          style={ui.track}
        >
          <View
            style={[
              ui.fill,
              {
                width: `${data.reputationScore}%`,
                backgroundColor: colors[tone],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}
