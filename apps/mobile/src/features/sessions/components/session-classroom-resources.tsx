import { useState } from "react";
import { Button } from "@/components/Button";
import { SessionSection } from "./session-section";
import { SessionWhiteboard } from "./session-whiteboard";
import { SessionRecordings } from "./session-recordings";

export function SessionClassroomResources({
  sessionId,
}: Readonly<{ sessionId: string }>) {
  const [board, setBoard] = useState(false),
    [recordings, setRecordings] = useState(false);
  return (
    <SessionSection title="Nội dung buổi học" icon="book">
      <Button variant="paper" icon="edit" onPress={() => setBoard(true)}>
        Mở bảng trắng
      </Button>
      <Button
        variant="paper"
        icon="video"
        accessibilityState={{ expanded: recordings }}
        onPress={() => setRecordings((value) => !value)}
      >
        {recordings ? "Thu gọn bản ghi" : "Xem bản ghi buổi học"}
      </Button>
      {recordings && (
        <SessionRecordings key={sessionId} sessionId={sessionId} />
      )}
      {board && (
        <SessionWhiteboard
          key={sessionId}
          sessionId={sessionId}
          onClose={() => setBoard(false)}
        />
      )}
    </SessionSection>
  );
}
