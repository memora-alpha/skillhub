"use client";
import { LoadingButton } from "@/components/loading-button";
import { Card } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { safeDownload } from "@/lib/staff/policy";
import { isSessionFailure } from "@/lib/staff/client";
import type { ReportCaseDetail } from "@/lib/staff/types";
import { parseWhiteboardScene } from "@/features/learner/livekit/whiteboard-scene";
import { WhiteboardCanvas } from "@/features/learner/livekit/whiteboard-canvas";
import { useState } from "react";
import { useStaffSession } from "./session";

type StaffWhiteboardReview = {
  caseId: string;
  revision: number;
  sceneData: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

type StaffRecordingReview = {
  caseId: string;
  url: string;
  expiresAt: string;
  mime: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SessionEvidenceReview({
  item,
  owns,
}: Readonly<{
  item: ReportCaseDetail;
  owns: boolean;
}>) {
  const { api, expire } = useStaffSession();
  const sessionId =
    item.session?.id ??
    item.relatedSessionId ??
    (item.targetType === "SESSION" ? item.targetId : null);
  const openCase = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(
    item.status,
  );

  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string>();
  const [board, setBoard] = useState<StaffWhiteboardReview | null>(null);

  const [recordingId, setRecordingId] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string>();
  const [playback, setPlayback] = useState<StaffRecordingReview | null>(null);

  if (!sessionId) return null;

  async function loadWhiteboard() {
    if (!sessionId || boardLoading) return;
    setBoardLoading(true);
    setBoardError(undefined);
    try {
      const res = await api<StaffWhiteboardReview>(
        `sessions/${sessionId}/whiteboard/staff-review?caseId=${encodeURIComponent(item.id)}`,
      );
      setBoard(res.data);
    } catch (cause) {
      if (isSessionFailure(cause)) expire();
      setBoardError(
        cause instanceof Error
          ? cause.message
          : "Không tải được bảng trắng buổi học.",
      );
    } finally {
      setBoardLoading(false);
    }
  }

  async function loadRecording() {
    if (!sessionId || recLoading) return;
    const trimmed = recordingId.trim();
    if (!uuidPattern.test(trimmed)) {
      setRecError("Nhập mã bản ghi (UUID) hợp lệ trước khi mở xem.");
      return;
    }
    setRecLoading(true);
    setRecError(undefined);
    setPlayback(null);
    try {
      const res = await api<StaffRecordingReview>(
        `sessions/${sessionId}/recordings/${trimmed}/staff-review?caseId=${encodeURIComponent(item.id)}`,
      );
      if (!safeDownload(res.data)) {
        throw new Error("Liên kết phát bản ghi không hợp lệ hoặc đã hết hạn.");
      }
      setPlayback(res.data);
    } catch (cause) {
      if (isSessionFailure(cause)) expire();
      setRecError(
        cause instanceof Error
          ? cause.message
          : "Không lấy được liên kết phát bản ghi buổi học.",
      );
    } finally {
      setRecLoading(false);
    }
  }

  const parsedBoard = board ? parseWhiteboardScene(board.sceneData) : null;

  return (
    <Card title="Bằng chứng phòng học (Bảng trắng & Bản ghi)">
      {!openCase || !owns ? (
        <p className="muted">
          Chỉ người phụ trách vụ việc đang mở mới có thể mở xem bảng trắng và
          bản ghi buổi học (mọi lượt xem đều được ghi nhận nhật ký kiểm toán).
        </p>
      ) : (
        <div className="stack">
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Bảng trắng buổi học (chỉ đọc)</strong>
              <LoadingButton
                type="button"
                className="btn btn-sm"
                loading={boardLoading}
                onClick={() => void loadWhiteboard()}
              >
                {board ? "Tải lại bảng trắng" : "Mở bảng trắng buổi học"}
              </LoadingButton>
            </div>
            {boardError && (
              <p role="alert" className="staff-error">
                {boardError}
              </p>
            )}
            {board && parsedBoard && (
              <>
                {board.revision === 0 && !parsedBoard.elements.length ? (
                  <p className="muted">
                    Buổi học chưa có dữ liệu bảng trắng nào được lưu.
                  </p>
                ) : (
                  <WhiteboardCanvas
                    elements={parsedBoard.elements}
                    readOnly
                    statusText={
                      board.updatedAt
                        ? `Phiên bản #${board.revision} · Cập nhật ${fmtDateTime(board.updatedAt)}`
                        : `Phiên bản #${board.revision}`
                    }
                  />
                )}
              </>
            )}
          </div>

          <hr />

          <div className="stack">
            <strong>Bản ghi buổi học (xem trực tuyến, có ghi audit)</strong>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                className="input"
                placeholder="Nhập mã bản ghi (recordingId UUID)…"
                value={recordingId}
                onChange={(e) => setRecordingId(e.target.value)}
                style={{ flex: "1 1 260px" }}
              />
              <LoadingButton
                type="button"
                className="btn btn-sm"
                loading={recLoading}
                onClick={() => void loadRecording()}
              >
                Mở bản ghi
              </LoadingButton>
            </div>
            {recError && (
              <p role="alert" className="staff-error">
                {recError}
              </p>
            )}
            {playback && (
              <div className="stack">
                {playback.mime.startsWith("audio/") ? (
                  <audio
                    controls
                    controlsList="nodownload"
                    src={playback.url}
                    style={{ width: "100%" }}
                  >
                    <track kind="captions" label="Phụ đề" />
                  </audio>
                ) : (
                  <video
                    controls
                    controlsList="nodownload"
                    playsInline
                    src={playback.url}
                    style={{
                      width: "100%",
                      maxHeight: 380,
                      borderRadius: 8,
                      background: "#000",
                    }}
                  >
                    <track kind="captions" label="Phụ đề" />
                  </video>
                )}
                <small className="muted">
                  Liên kết phát có hiệu lực tới{" "}
                  {fmtDateTime(playback.expiresAt)}. Lượt xem đã được ghi vào
                  nhật ký kiểm toán.
                </small>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
