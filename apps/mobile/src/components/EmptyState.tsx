import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { typography, appColors as colors, fonts } from "@/constants/theme";

export function EmptyState({
  title,
  description,
  icon = "search",
  action,
  onAction,
}: {
  title: string;
  description: string;
  icon?: IconName;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={32} color={colors.muted} />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {action && onAction && (
        <Button variant="paper" onPress={onAction}>
          {action}
        </Button>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: "center", padding: 24, gap: 12 },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
    textAlign: "center",
  },
  description: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
  },
});
