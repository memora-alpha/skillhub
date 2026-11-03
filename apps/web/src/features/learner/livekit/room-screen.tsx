"use client";
import Link from "next/link";
import { useRef } from "react";
import { useClock } from "../hooks/use-clock";
import { useUserResource } from "../hooks/use-user-resource";
import type { LearningSession } from "../types";
import { Back, Feedback, PageHeading, formatTime } from "../components/common";
import { canEnterSession } from "../sessions/session-policy";
import { userErrorText } from "../api/client";
import { useLearningRoom } from "./use-learning-room";
export function LearningRoomScreen({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningSession>("sessions/" + id),
    videoRef = useRef<HTMLDivElement>(null),
    audioRef = useRef<HTMLDivElement>(null),
    room = useLearningRoom(id, videoRef, audioRef);
  const now = useClock();
  const connected = room.status === "connected",
    connecting = ["connecting", "reconnecting", "signalReconnecting"].includes(
      room.status,
    );
  const labels: Record<string, string> = {
    connected: "Đã kết nối phòng học",
    disconnected: "Chưa vào phòng",
    connecting: "Đang kết nối…",
    reconnecting: "Đang kết nối lại…",
    signalReconnecting: "Đang kết nối lại…",
  };
  return (
    <>
      <Back href={"/learn/sessions/" + id}>Chi tiết buổi học</Back>
      <PageHeading
        title="Phòng học trực tuyến"
        description={
          query.data
            ? formatTime(query.data.startAt) +
              " – " +
              formatTime(query.data.endAt)
            : undefined
        }
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <Feedback error={room.error} />
      {room.notice && (
        <p className="learner-notice" role="status">
          {room.notice}
        </p>
      )}
      <section className="learner-room-stage">
        <p className="learner-live-label" role="status">
          {labels[room.status] ?? "Đang kiểm tra kết nối"}
          {connected && room.participants === 0
            ? " · Đang chờ đối tác vào phòng"
            : ""}
        </p>
        <div className="learner-media-grid" ref={videoRef} />
        <div className="learner-room-audio" ref={audioRef} />
      </section>
      {connected ? (
        <div className="learner-room-controls">
          <button
            className="btn"
            aria-pressed={room.microphone}
            disabled={room.mediaBusy}
            onClick={() => {
              void room.toggle("microphone");
            }}
          >
            {room.microphone ? "Tắt micro" : "Bật micro"}
          </button>
          <button
            className="btn"
            aria-pressed={room.camera}
            disabled={room.mediaBusy}
            onClick={() => {
              void room.toggle("camera");
            }}
          >
            {room.camera ? "Tắt camera" : "Bật camera"}
          </button>
          <button
            className="btn"
            aria-pressed={room.screen}
            disabled={room.mediaBusy}
            onClick={() => {
              void room.toggle("screen");
            }}
          >
            {room.screen ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
          </button>
          {room.audioBlocked && (
            <button className="btn btn-primary" onClick={room.startAudio}>
              Bật âm thanh
            </button>
          )}
          <button className="btn" onClick={room.close}>
            Rời phòng
          </button>
        </div>
      ) : (
        <div className="learner-room-controls">
          <button
            className="btn btn-primary"
            disabled={
              connecting || !query.data || !canEnterSession(query.data, now)
            }
            onClick={() => {
              void room.join();
            }}
          >
            {connecting ? "Đang kết nối…" : "Kết nối phòng học"}
          </button>
          <button
            className="btn"
            disabled={query.loading}
            onClick={query.reload}
          >
            Kiểm tra trạng thái phòng
          </button>
        </div>
      )}
      {query.data &&
        !connected &&
        !connecting &&
        !canEnterSession(query.data, now) && (
          <p className="learner-notice">
            {userErrorText(
              409,
              query.data.join?.reason ?? "SESSION_NOT_JOINABLE",
            )}
          </p>
        )}
      <p className="muted">
        Chỉ bật camera/micro sau khi bạn chọn. Rời phòng không tự xác nhận hoàn
        tất;{" "}
        <Link href={"/learn/sessions/" + id}>quay lại chi tiết buổi học</Link>{" "}
        để kiểm tra điểm danh và xác nhận.
      </p>
    </>
  );
}
