import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Tree = { type: unknown; props: Record<string, unknown> };

test("QR root stays reachable for guests and restored sessions without exposing protected screens", async () => {
  let status = "guest";
  const session = () => ({
    status,
    session:
      status === "authenticated" ? { email: "owner@example.test" } : null,
    runtime: { controller: { generation: 0 } },
  });
  const jsx = (type: unknown, props: Tree["props"]): Tree => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: { useEffect: () => {} },
    "expo-router": {
      Stack: { Screen: "Screen", Protected: "Protected" },
      Redirect: "Redirect",
      usePathname: () => "/",
    },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "@/features/auth": {
      WelcomeScreen: "WelcomeScreen",
      AuthNavigator: "AuthNavigator",
      useAuthSession: session,
    },
    "../src/features/auth/context/AuthSession": { useAuthSession: session },
    "../src/features/auth/utils/password-recovery-flow": {
      passwordRecoveryStore: {},
    },
    "@/constants/theme": { colors: {} },
    "@/providers/AppProviders": { AppProviders: "AppProviders" },
    "@/qa/payment-qa-entry": { PaymentQaEntry: "PaymentQaEntry" },
  };
  const registered = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(name, { namedExports }),
  );
  function available(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(available);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const tree = node as Tree;
    if (tree.type === "Protected" && !tree.props.guard) return [];
    if (tree.type === "Screen") return [String(tree.props.name)];
    return available(tree.props.children);
  }
  try {
    const { AuthNavigator } =
      await import("../src/features/auth/components/AuthNavigator");
    const { default: RootRoute } = await import("../src/app/index");
    const { unstable_settings } = await import("../src/app/_layout");
    assert.equal(unstable_settings.anchor, "index");
    const guestScreens = available(AuthNavigator());
    assert.ok(guestScreens.includes("index"));
    assert.ok(guestScreens.includes("login"));
    assert.ok(!guestScreens.includes("(tabs)"));
    assert.ok(!guestScreens.includes("wallet/index"));
    assert.equal((RootRoute() as unknown as Tree).type, "WelcomeScreen");

    status = "authenticated";
    const accountScreens = available(AuthNavigator());
    assert.ok(accountScreens.includes("index"));
    assert.ok(accountScreens.includes("(tabs)"));
    assert.ok(accountScreens.includes("wallet/index"));
    assert.ok(!accountScreens.includes("login"));
    const redirect = RootRoute() as unknown as Tree;
    assert.equal(redirect.type, "Redirect");
    assert.equal(redirect.props.href, "/home");

    status = "guest";
    assert.equal((RootRoute() as unknown as Tree).type, "WelcomeScreen");
    assert.ok(!available(AuthNavigator()).includes("(tabs)"));
  } finally {
    for (const entry of registered.reverse()) entry.restore();
  }
});
