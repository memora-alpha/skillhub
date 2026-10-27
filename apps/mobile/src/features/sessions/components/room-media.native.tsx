import { Component, lazy, Suspense, type ReactNode } from "react";
import { ActivityIndicator } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import type { RoomMediaProps } from "./room-media.types";

// Keep Expo Go and the rest of the app usable without loading native WebRTC.
export const roomMediaAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const NativeRoom = lazy(() => import("./native-room"));

class RoomBoundary extends Component<
  { children: ReactNode; onLeave: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <>
          <FormNotice tone="error">
            Không mở được camera và âm thanh trong bản ứng dụng này. Hãy cập
            nhật bản cài đặt SkillHub rồi thử lại.
          </FormNotice>
          <Button onPress={this.props.onLeave}>Quay lại buổi học</Button>
        </>
      );
    return this.props.children;
  }
}
export function RoomMedia(props: RoomMediaProps) {
  if (!roomMediaAvailable)
    return (
      <FormNotice tone="info">
        Bản ứng dụng này chưa hỗ trợ gọi video. Hãy cài bản SkillHub có tính
        năng phòng học.
      </FormNotice>
    );
  return (
    <RoomBoundary onLeave={props.onLeave}>
      <Suspense
        fallback={<ActivityIndicator accessibilityLabel="Đang mở phòng học" />}
      >
        <NativeRoom {...props} />
      </Suspense>
    </RoomBoundary>
  );
}
