"use client";
import { useState } from "react";
import { Feedback, Panel } from "../components/common";
import { useRoomWhiteboard } from "../livekit/use-room-whiteboard";
import { WhiteboardCanvas } from "../livekit/whiteboard-canvas";
import { SessionCardHeading } from "./session-detail-sections";
import styles from "./session-detail.module.css";

export function SessionWhiteboardPanel({
  sessionId,
}: Readonly<{ sessionId: string }>) {
  const [open, setOpen] = useState(false);
  const wb = useRoomWhiteboard({ sessionId, enabled: open });

  return (
    <Panel className={styles.card}>
      <SessionCardHeading
        icon="book"
        title="Bảng trắng buổi học"
        subtitle="Chuẩn bị bài trước buổi học hoặc xem lại nội dung bảng trắng"
      />
      <div className={styles.content}>
        {!open ? (
          <div>
            <p>
              Mở bảng trắng để xem lại các nét vẽ đã lưu (hoặc chuẩn bị trước
              nếu đang trong khung giờ chỉnh sửa).
            </p>
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              Mở bảng trắng
            </button>
          </div>
        ) : (
          <>
            <Feedback
              loading={wb.loading}
              error={wb.error}
              reload={wb.reload}
            />
            <WhiteboardCanvas
              elements={wb.elements}
              readOnly={wb.readOnly}
              readOnlyNotice={wb.readOnlyNotice}
              statusText={wb.statusText}
              onMutate={wb.readOnly ? undefined : wb.mutate}
              onSaveNow={wb.readOnly ? undefined : wb.saveNow}
              saving={wb.saving}
              onClose={() => {
                wb.saveNow();
                setOpen(false);
              }}
            />
          </>
        )}
      </div>
    </Panel>
  );
}
