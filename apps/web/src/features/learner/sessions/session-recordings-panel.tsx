"use client";
import { LoadingButton } from "@/components/loading-button";
import { useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
import { Feedback, Panel, Status, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { safeDownloadUrl } from "../account/view-policy";
import type {
  SessionRecording,
  SessionRecordingPlayback,
  SessionRecordingStatus,
} from "../types";
import { SessionCardHeading } from "./session-detail-sections";
import styles from "./session-detail.module.css";

const statusLabels: Record<SessionRecordingStatus, string> = {
  REQUESTED: "Đang chờ đối phương đồng ý",
  DECLINED: "Đã bị từ chối",
  REQUEST_EXPIRED: "Yêu cầu đã hết hạn",
  STARTING: "Đang khởi tạo ghi hình",
  RECORDING: "Đang ghi hình",
  STOPPING: "Đang dừng & xử lý",
  READY: "Sẵn sàng xem lại",
  FAILED: "Ghi hình thất bại",
  EXPIRED: "Đã hết hạn lưu trữ",
  DELETED: "Đã xóa",
};

function recordingBadgeValue(status: SessionRecordingStatus) {
  if (status === "READY") return "COMPLETED";
  if (status === "RECORDING" || status === "STARTING") return "ONGOING";
  if (status === "REQUESTED" || status === "STOPPING") return "PENDING";
  if (status === "FAILED" || status === "DECLINED") return "FAILED";
  return "ARCHIVED";
}

function formatDuration(ms: number | null) {
  if (!ms || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} phút ${String(s).padStart(2, "0")} giây`;
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}

function isPlaybackValid(playback: SessionRecordingPlayback) {
  return (
    safeDownloadUrl(playback.url) &&
    Number.isFinite(Date.parse(playback.expiresAt)) &&
    Date.parse(playback.expiresAt) > Date.now()
  );
}

function playbackErrorMessage(cause: unknown): string {
  if (
    cause instanceof UserApiError &&
    cause.status === 503 &&
    cause.code === "API_UNAVAILABLE"
  ) {
    return "Dịch vụ lưu trữ/phát bản ghi hiện chưa được cấu hình hoặc tạm gián đoạn trên máy chủ (HTTP 503).";
  }
  if (cause instanceof Error) return cause.message;
  return "Không lấy được liên kết phát bản ghi.";
}

export function SessionRecordingsPanel({
  sessionId,
}: Readonly<{ sessionId: string }>) {
  const { request } = useUserSession();
  const query = useUserResource<{ items: SessionRecording[] }>(
    `sessions/${sessionId}/recordings`,
    {
      refetchInterval: (data) =>
        data?.items.some((item) =>
          ["REQUESTED", "STARTING", "RECORDING", "STOPPING"].includes(
            item.status,
          ),
        )
          ? 5000
          : false,
    },
  );
  const [playing, setPlaying] = useState<{
    id: string;
    playback: SessionRecordingPlayback;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const items = query.data?.items ?? [];

  async function openPlayback(recordingId: string) {
    if (busyId) return;
    setBusyId(recordingId);
    setActionError(undefined);
    setNotice(undefined);
    try {
      const res = await request<SessionRecordingPlayback>(
        `sessions/${sessionId}/recordings/${recordingId}/playback`,
      );
      if (!isPlaybackValid(res.data)) {
        throw new Error("Liên kết phát bản ghi không hợp lệ hoặc đã hết hạn.");
      }
      setPlaying({ id: recordingId, playback: res.data });
    } catch (cause) {
      setActionError(playbackErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRecording(recordingId: string) {
    if (busyId) return;
    setBusyId(recordingId);
    setActionError(undefined);
    setNotice(undefined);
    try {
      await request<SessionRecording>(
        `sessions/${sessionId}/recordings/${recordingId}`,
        { method: "DELETE" },
      );
      if (playing?.id === recordingId) setPlaying(null);
      setConfirmDeleteId(null);
      setNotice("Đã xóa bản ghi cho cả hai người tham gia.");
      query.reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Không thể xóa bản ghi.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel className={styles.card}>
      <SessionCardHeading
        icon="video"
        tone="sage"
        title="Bản ghi buổi học"
        subtitle="Ghi hình có sự đồng ý của cả hai bên để xem lại học tập hoặc làm bằng chứng tranh chấp"
      />
      <div className={`${styles.content} ${styles.recordingsList}`}>
        <Feedback
          loading={query.initialLoading}
          error={query.error ?? actionError}
          reload={query.reload}
        />
        {notice && (
          <p className="learner-notice">
            <output>{notice}</output>
          </p>
        )}
        {!query.initialLoading && !items.length && !query.error && (
          <div className={styles.recordingEmpty}>
            <ProductIcon name="video" size={18} />
            <p>Chưa có bản ghi nào cho buổi học này.</p>
          </div>
        )}
        {items.map((item) => (
          <article key={item.id} className={styles.recordingCard}>
            <div className={styles.recordingHead}>
              <Status
                value={recordingBadgeValue(item.status)}
                label={statusLabels[item.status] ?? item.status}
              />
              <small className={styles.recordingTime}>
                Yêu cầu lúc {formatTime(item.requestedAt)}
              </small>
            </div>

            <div className={styles.recordingMeta}>
              <span>Thời lượng: {formatDuration(item.durationMs)}</span>
              <span>· Dung lượng: {formatBytes(item.bytes)}</span>
              {typeof item.retentionDays === "number" && (
                <span>· Lưu {item.retentionDays} ngày</span>
              )}
              {item.expiresAt && item.status === "READY" && (
                <span>· Hết hạn: {formatTime(item.expiresAt)}</span>
              )}
            </div>

            {item.heldByReport && (
              <p className={styles.recordingHeld}>
                Bản ghi đang được tạm giữ do buổi học có báo cáo tranh chấp mở
                (chưa thể xóa và không tự hết hạn cho tới khi vụ việc đóng).
              </p>
            )}

            {item.status === "READY" && (
              <div className={styles.recordingActions}>
                <LoadingButton
                  type="button"
                  className="btn btn-primary"
                  loading={busyId === item.id}
                  disabled={!!busyId}
                  onClick={() => void openPlayback(item.id)}
                >
                  <ProductIcon name="video" size={15} />
                  {playing?.id === item.id
                    ? "Tải lại liên kết phát"
                    : "Xem bản ghi"}
                </LoadingButton>
                {confirmDeleteId === item.id ? (
                  <>
                    <LoadingButton
                      type="button"
                      className="btn btn-danger"
                      loading={busyId === item.id}
                      disabled={!!busyId}
                      onClick={() => void deleteRecording(item.id)}
                    >
                      Xác nhận xóa cho cả hai bên
                    </LoadingButton>
                    <button
                      type="button"
                      className="btn"
                      disabled={!!busyId}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busyId || item.heldByReport}
                    title={
                      item.heldByReport
                        ? "Không thể xóa khi buổi học đang có báo cáo mở"
                        : "Xóa vĩnh viễn bản ghi cho cả hai người tham gia"
                    }
                    onClick={() => setConfirmDeleteId(item.id)}
                  >
                    <ProductIcon name="trash" size={15} />
                    Xóa bản ghi
                  </button>
                )}
              </div>
            )}

            {playing?.id === item.id && (
              <div className={styles.recordingPlayer}>
                {playing.playback.mime.startsWith("audio/") ? (
                  <audio
                    controls
                    controlsList="nodownload"
                    src={playing.playback.url}
                    className={styles.recordingAudio}
                  >
                    <track kind="captions" label="Phụ đề" />
                  </audio>
                ) : (
                  <video
                    controls
                    controlsList="nodownload"
                    playsInline
                    src={playing.playback.url}
                    className={styles.recordingVideo}
                  >
                    <track kind="captions" label="Phụ đề" />
                  </video>
                )}
                <small className={styles.recordingExpiry}>
                  Liên kết phát trực tuyến hết hạn lúc{" "}
                  {formatTime(playing.playback.expiresAt)} (chỉ xem trực tiếp,
                  không hỗ trợ tải tệp).
                </small>
              </div>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}
