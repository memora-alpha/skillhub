import { useEffect, useState } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { Button } from "@/components/Button";
import { useSessionRecordings } from "../hooks/use-session-recordings";
import { SessionWhiteboard } from "./session-whiteboard";
import { RecordingControls } from "./recording-controls";
import { View } from "react-native";
import { classroomStyles as styles } from "./classroom.styles";

function metadataHasRecording(metadata: string | undefined) {
  try {
    const parsed = JSON.parse(metadata ?? "{}");
    return typeof parsed?.recording?.id === "string" && !!parsed.recording.id;
  } catch {
    return false;
  }
}
export function NativeClassroomTools({
  sessionId,
  room,
  peerIdentity,
  connected,
  recordingCanStart,
}: Readonly<{
  sessionId: string;
  room: Room | null;
  peerIdentity: string;
  connected: boolean;
  recordingCanStart: boolean;
}>) {
  const [boardOpen, setBoardOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordings = useSessionRecordings(sessionId, connected);
  useEffect(() => {
    const update = () => setRecording(metadataHasRecording(room?.metadata));
    update();
    room?.on(RoomEvent.RoomMetadataChanged, update);
    return () => {
      room?.off(RoomEvent.RoomMetadataChanged, update);
    };
  }, [room]);
  return (
    <View style={styles.stack}>
      <Button variant="paper" icon="edit" onPress={() => setBoardOpen(true)}>
        Mở bảng trắng
      </Button>
      <RecordingControls
        recordings={recordings}
        connected={connected}
        canStart={recordingCanStart}
        metadataRecording={recording}
      />
      {boardOpen && (
        <SessionWhiteboard
          sessionId={sessionId}
          room={connected ? room : null}
          peerIdentity={peerIdentity}
          onClose={() => setBoardOpen(false)}
        />
      )}
    </View>
  );
}
