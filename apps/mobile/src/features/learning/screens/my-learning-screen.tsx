import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import {
  MyRequestsContent,
  RequestCreateButton,
} from "@/features/learning-requests";
import { ApiPathsContent } from "@/features/learning-paths";
import { appColors as colors, fonts, typography } from "@/constants/theme";

const tabs = [
  {
    value: "requests",
    label: "Yêu cầu học",
  },
  {
    value: "paths",
    label: "Lộ trình học",
  },
] as const;

export function MyLearningScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const router = useRouter();
  const tab = params.tab === "paths" ? "paths" : "requests";
  return (
    <AppScreenLayout
      title="Hành trình của tôi"
      selected="Hồ sơ"
      rightAction={
        tab === "requests" ? <RequestCreateButton compact /> : undefined
      }
      back={{ href: "/profile", label: "Quay lại hồ sơ" }}
    >
      {() => (
        <View style={styles.content}>
          <View
            style={styles.tabs}
            accessibilityRole="tablist"
            accessibilityLabel="Yêu cầu học và lộ trình học"
          >
            {tabs.map((item) => {
              const selected = item.value === tab;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  aria-selected={selected}
                  onPress={() => router.setParams({ tab: item.value })}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.tabLabel, selected && styles.selectedLabel]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {tab === "requests" ? (
            <MyRequestsContent embedded />
          ) : (
            <ApiPathsContent />
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 12,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  selected: { borderBottomColor: colors.primary },
  pressed: { opacity: 0.7 },
  tabLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.muted,
    textAlign: "center",
  },
  selectedLabel: { color: colors.primary },
});
