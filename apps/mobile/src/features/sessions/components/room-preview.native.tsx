import { lazy, Suspense } from "react";
import { ActivityIndicator } from "react-native";
import { RoomBoundary, roomMediaAvailable } from "./room-media.native";
const Preview = lazy(() => import("./native-room-preview"));
export function RoomPreview({ onUnavailable }: { onUnavailable: () => void }) {
  if (!roomMediaAvailable) return null;
  return (
    <RoomBoundary onLeave={onUnavailable}>
      <Suspense
        fallback={
          <ActivityIndicator accessibilityLabel="Đang mở xem trước camera" />
        }
      >
        <Preview />
      </Suspense>
    </RoomBoundary>
  );
}
