import type { ComponentProps } from "react";
import { Redirect, Tabs } from "expo-router";
import { SafeAreaView } from "@/components/SafeArea";
import { AppNavigation } from "@/features/shell";
import { appTabs } from "@/constants/navigation";
import { colors, signedInChrome } from "@/constants/theme";
import { useAuthSession } from "@/features/auth";

export const unstable_settings = { anchor: "home" };

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

function MobileTabBar({
  state,
  emitter,
  navigateToTab,
}: Readonly<TabBarProps>) {
  const selected = appTabs.find(
    (tab) => tab.name === state.routes[state.index]?.name,
  )?.label;
  const navigate = (label: string) => {
    const tab = appTabs.find((item) => item.label === label);
    const route = state.routes.find((item) => item.name === tab?.name);
    if (!route) return;
    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigateToTab(route.key);
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
  const { session } = useAuthSession();
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
