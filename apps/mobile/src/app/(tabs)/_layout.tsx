import { Redirect, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppNavigation } from "@/components/AppHeader";
import { appTabs } from "@/constants/navigation";
import { colors } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";

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
      tabBar={({ state, navigation }) => (
        <SafeAreaView
          edges={["left", "right", "bottom"]}
          style={{ backgroundColor: colors.white }}
        >
          <AppNavigation
            selected={
              appTabs.find(
                (tab) => tab.name === state.routes[state.index]?.name,
              )?.label
            }
            onAction={(label) => {
              const tab = appTabs.find((item) => item.label === label);
              const route = state.routes.find(
                (item) => item.name === tab?.name,
              );
              if (!route) return;
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        </SafeAreaView>
      )}
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
