import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import {
  MyRequestsContent,
  RequestCreateButton,
} from "@/features/learning-requests";
import { ApiPathsContent } from "@/features/learning-paths";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

const tabs = [
  {
    value: "requests",
    label: "Yêu cầu học",
  },
  {
    value: "paths",
    label: "Lộ trình",
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
            accessibilityLabel="Yêu cầu học và lộ trình"
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
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <ApiPathsContent />
            </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceInset,
    borderRadius: appRadius.control,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: appRadius.control,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  tabLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.muted,
    textAlign: "center",
  },
  selectedLabel: { color: colors.primary },
  scroll: { paddingBottom: 24, gap: 16 },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
