import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Node = { type: unknown; props: Record<string, unknown> };

test("custom tab bar uses SDK 58 emitter and route keys, respecting prevented presses", async () => {
  const jsx = (type: unknown, props: Node["props"]): Node => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": { Tabs: { Screen: "Screen" }, Redirect: "Redirect" },
    "@/components/SafeArea": { SafeAreaView: "SafeAreaView" },
    "@/features/auth": {
      useAuthSession: () => ({ session: { userId: "owner" } }),
    },
    "@/features/shell": { AppNavigation: "AppNavigation" },
    "@/constants/theme": { colors: {}, signedInChrome: {} },
    "@/constants/navigation": {
      appTabs: [
        { name: "home", label: "Trang chủ" },
        { name: "messages", label: "Tin nhắn" },
      ],
    },
  };
  const registered = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(name, { namedExports }),
  );
  try {
    const { default: MainTabsLayout, unstable_settings } =
      await import("../src/app/(tabs)/_layout");
    assert.equal(unstable_settings.anchor, "home");
    const layout = MainTabsLayout() as unknown as Node;
    const renderTabBar = layout.props.tabBar as (props: unknown) => Node;
    const events: unknown[] = [];
    const destinations: string[] = [];
    let prevented = false;
    const bar = renderTabBar({
      state: {
        index: 0,
        routes: [
          { name: "home", key: "home-key" },
          { name: "messages", key: "messages-key" },
        ],
      },
      emitter: {
        emit(event: unknown) {
          events.push(event);
          return { defaultPrevented: prevented };
        },
      },
      navigateToTab: (key: string) => destinations.push(key),
    });
    const navigation = bar.props.children as Node;
    const onAction = navigation.props.onAction as (label: string) => void;
    assert.equal(navigation.props.selected, "Trang chủ");
    onAction("Tin nhắn");
    assert.deepEqual(events, [
      { type: "tabPress", target: "messages-key", canPreventDefault: true },
    ]);
    assert.deepEqual(destinations, ["messages-key"]);
    prevented = true;
    onAction("Trang chủ");
    assert.equal(events.length, 2);
    assert.deepEqual(destinations, ["messages-key"]);
    onAction("Không tồn tại");
    assert.equal(events.length, 2);
  } finally {
    for (const entry of registered.reverse()) entry.restore();
  }
});
