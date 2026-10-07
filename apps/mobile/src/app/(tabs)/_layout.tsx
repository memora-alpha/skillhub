import type { ComponentProps } from "react";
import { Redirect, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppNavigation } from "@/features/shell";
import { appTabs } from "@/constants/navigation";
import { colors, signedInChrome } from "@/constants/theme";
import { useMockSession } from "@/features/auth";

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

function MobileTabBar({ state, navigation }: Readonly<TabBarProps>) {
  const selected = appTabs.find(
    (tab) => tab.name === state.routes[state.index]?.name,
  )?.label;
  const navigate = (label: string) => {
    const tab = appTabs.find((item) => item.label === label);
    const route = state.routes.find((item) => item.name === tab?.name);
    if (!route) return;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ backgroundColor: signedInChrome.surface }}
    >
      <AppNavigation selected={selected} onAction={navigate} />
    </SafeAreaView>
  );
}

export default function MainTabsLayout() {
  const { session } = useMockSession();
  if (!session) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "none",
        sceneStyle: { backgroundColor: colors.cream },
      }}
      tabBar={MobileTabBar}
    >
      {appTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.label }}
        />
      ))}
    </Tabs>
  );
}
