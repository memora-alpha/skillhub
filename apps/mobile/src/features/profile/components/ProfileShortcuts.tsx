import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { fonts, iconSizes, typography } from "@/constants/theme";
import { profileActions as shortcuts } from "../mocks/profile";
import { profileStyles } from "./ProfilePrimitives";
import {
  profileActionTints,
  profileColors,
  profileShadows,
} from "../constants/theme";

export function ProfileShortcuts({
  onOpen,
  onSettings,
}: {
  onOpen: (label: string) => void;
  onSettings: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <View style={styles.grid}>
      {shortcuts.map((shortcut) => (
        <Pressable
          key={shortcut.label}
          accessibilityRole="button"
          accessibilityLabel={shortcut.label}
          onPress={() =>
            shortcut.icon === "settings" ? onSettings() : onOpen(shortcut.label)
          }
          onHoverIn={() => setHovered(shortcut.label)}
          onHoverOut={() => setHovered(null)}
          style={({ pressed }) => [
            styles.shortcut,
            (pressed || hovered === shortcut.label) && styles.raised,
          ]}
        >
          <View
            style={[
              styles.icon,
              {
                backgroundColor:
                  profileActionTints[shortcut.icon] ?? profileColors.neutral,
              },
            ]}
          >
            <Icon
              name={shortcut.icon}
              size={iconSizes.control}
              color={shortcut.color}
              filled={false}
            />
          </View>
          <Text style={[profileStyles.label, styles.label]}>
            {shortcut.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcut: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 64,
    borderWidth: 1,
    borderColor: profileColors.border,
    borderRadius: 12,
    backgroundColor: profileColors.surface,
    boxShadow: profileShadows.action,
  },
  raised: { boxShadow: profileShadows.actionRaised },
  icon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    ...typography.secondary,
  },
});
