import type { ReactNode } from "react";
import { Modal, View } from "react-native";
import { usePathname } from "expo-router";
import { ConnectionScreen } from "@/components/ConnectionScreen";
import { useAppConnection } from "./use-app-connection";

export function ConnectionGate({ children }: { children: ReactNode }) {
  const state = useAppConnection();
  const pathname = usePathname();
  // Cached chat keeps its composer usable for the explicit text outbox.
  const chat = /^\/chat\/[^/]+\/?$/.test(pathname);
  const blocked = !!state.reason && !chat;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={blocked ? "none" : "auto"}
        aria-hidden={blocked}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      <Modal
        visible={blocked}
        animationType="none"
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <ConnectionScreen />
      </Modal>
    </View>
  );
}
