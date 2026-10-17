import { lazy, Suspense } from "react";
import { Text } from "react-native";

// Normal Wallet/Home barrel imports do not evaluate sample screens or fixtures.
const Content = lazy(() =>
  import("./screens").then((module) => ({
    default: module.WalletPreviewContent,
  })),
);
export function WalletPreviewScreen() {
  return (
    <Suspense fallback={<Text>Đang mở bản xem thử</Text>}>
      <Content />
    </Suspense>
  );
}
