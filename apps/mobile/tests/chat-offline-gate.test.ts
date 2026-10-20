import assert from "node:assert/strict";
import test from "node:test";
import { load, nodes } from "./fixtures/proposal-ui";

test("offline chat remains interactive while other routes retain the full connection boundary", () => {
  let path = "/chat/10000000-0000-4000-8000-000000000258";
  let reason: string | null = "offline";
  const gate = load("../../src/providers/ConnectionGate.tsx", {
    "react-native": { Modal: "Modal", View: "View" },
    "expo-router": { usePathname: () => path },
    "@/components/ConnectionScreen": { ConnectionScreen: "ConnectionScreen" },
    "./use-app-connection": {
      useAppConnection: () => ({ reason, retry() {} }),
    },
  }).ConnectionGate!;
  let tree = gate({ children: "chat" });
  assert.equal(nodes(tree, "Modal")[0]!.props.visible, false);
  assert.equal(nodes(tree, "View")[1]!.props.pointerEvents, "auto");
  for (path of [
    "/send-proposal",
    "/chat-attachment",
    "/account-settings",
    "/messages",
    "/paths/one",
  ]) {
    tree = gate({ children: "form" });
    assert.equal(nodes(tree, "Modal")[0]!.props.visible, true);
    assert.equal(nodes(tree, "View")[1]!.props.pointerEvents, "none");
  }
  reason = null;
  assert.equal(
    nodes(gate({ children: "online" }), "Modal")[0]!.props.visible,
    false,
  );
});
