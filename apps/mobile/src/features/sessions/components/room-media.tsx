import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import type { RoomMediaProps } from "./room-media.types";

export const roomMediaAvailable = false;
export function RoomMedia(props: RoomMediaProps) {
  return (
    <>
      <FormNotice tone="info">
        Hãy dùng bản cài đặt SkillHub Android hoặc iOS để gọi video.
      </FormNotice>
      <Button onPress={props.onLeave}>Quay lại buổi học</Button>
    </>
  );
}
