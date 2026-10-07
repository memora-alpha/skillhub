import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appTabs } from "@/constants/navigation";
import { fonts, iconSizes, signedInChrome } from "@/constants/theme";

export function AppNavigation({
  onAction,
  selected = "Trang chủ",
}: {
  onAction: (title: string) => void;
  selected?: string;
}) {
  return (
    <View style={styles.nav}>
      {appTabs.map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.label === selected }}
          aria-selected={tab.label === selected}
          onPress={() => onAction(tab.label)}
          style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.tabIcon}>
            <Icon
              name={tab.icon}
              size={iconSizes.navigation}
              color={
                tab.label === selected
                  ? signedInChrome.accent
                  : signedInChrome.muted
              }
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              tab.label === selected && { color: signedInChrome.accent },
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    width: "100%",
    minHeight: 64,
    maxWidth: 1024,
    alignSelf: "center",
    borderTopWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: signedInChrome.surface,
    boxShadow: "0 -2px 12px rgba(53, 43, 31, 0.03)",
  },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
  },
  tabIcon: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: signedInChrome.muted,
    includeFontPadding: false,
  },
});
