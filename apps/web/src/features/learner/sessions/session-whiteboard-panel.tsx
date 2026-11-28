"use client";
import { useState } from "react";
import { Feedback, Panel } from "../components/common";
import { ProductIcon } from "../components/product-icon";
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
        icon="edit"
        tone="sage"
        title="Bảng trắng buổi học"
        subtitle="Chuẩn bị bài trước buổi học hoặc xem lại nội dung bảng trắng"
      />
      <div className={styles.content}>
        {!open ? (
          <div className={styles.toolLaunchBox}>
            <p>
              Mở bảng trắng để xem lại các nét vẽ đã lưu (hoặc chuẩn bị trước
              nếu đang trong khung giờ chỉnh sửa).
            </p>
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              <ProductIcon name="edit" size={15} />
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
            {typeof wb.retentionDays === "number" && (
              <p className={styles.retentionNotice}>
                <ProductIcon name="clock" size={14} />
                Thời hạn lưu bảng trắng: {wb.retentionDays} ngày sau khi buổi
                học kết thúc.
              </p>
            )}
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
