import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import {
  achievementTitleLabel,
  achievementDescriptionLabel,
} from "@/constants/achievement-copy";
import type { Achievements } from "../api/achievements-api";
import { achievementIcon } from "../utils/achievement-presentation";
import { achievementStyles as styles } from "./achievement.styles";

export function AchievementCard({
  item,
  selected,
  disabled,
  saving,
  onSelect,
}: Readonly<{
  item: Achievements["items"][number];
  selected: boolean;
  disabled: boolean;
  saving: boolean;
  onSelect: () => void;
}>) {
  const title = achievementTitleLabel(item.title);
  return (
    <View style={[styles.tile, selected && styles.selectedTile]}>
      <View style={styles.smallBadge}>
        <Icon
          name={achievementIcon(item.code)}
          size={22}
          color={colors.primary}
          filled={false}
        />
      </View>
      <View style={styles.grow}>
        <Text style={styles.tileTitle}>{title}</Text>
        {!!item.description && (
          <Text style={styles.description}>
            {achievementDescriptionLabel(item.description)}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selected
            ? `${title}, đang dùng làm danh hiệu`
            : `Đặt danh hiệu ${title}`
        }
        accessibilityHint={achievementDescriptionLabel(item.description)}
        accessibilityState={{
          selected,
          disabled: disabled || selected,
          busy: saving,
        }}
        disabled={disabled || selected}
        onPress={onSelect}
        style={({ pressed }) => [
          styles.tileAction,
          selected && styles.selectedTileAction,
          pressed && styles.pressed,
          disabled && !selected && styles.disabled,
        ]}
      >
        {selected ? (
          <Icon name="check-circle" size={22} color={colors.primary} />
        ) : (
          <Text style={styles.action}>{saving ? "Đang lưu…" : "Dùng"}</Text>
        )}
      </Pressable>
    </View>
  );
}
