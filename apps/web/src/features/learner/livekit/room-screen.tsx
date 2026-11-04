"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { useClock } from "../hooks/use-clock";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { LearningSession } from "../types";
import { formatTime } from "../components/common";
import { canEnterSession } from "../sessions/session-policy";
import { userErrorText } from "../api/client";
import { useLearningRoom } from "./use-learning-room";
import type { RoomTile } from "./room-media";
import { RoomStage } from "./room-stage";
import {
  roomPerson,
  safeRoomAvatar,
  type PublicRoomProfile,
} from "./room-profiles";
import { RoomIcon, type RoomIconName } from "./room-icon";
import { RoomTrack } from "./room-track";
import { RoomPrejoin } from "./room-prejoin";
import { useRoomPreview } from "./use-room-preview";
import { useCameraBackground } from "./use-camera-background";
import { useRoomAudio } from "./use-room-audio";
import { useRoomDevices } from "./use-room-devices";
import { RoomMediaSettings } from "./room-media-settings";
import { RoomBackgroundControl } from "./room-background-control";
import { useRoomChat } from "./use-room-chat";
import { RoomChat } from "./room-chat";
import styles from "./room.module.css";

function IconButton({
  icon,
  label,
  tone,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: RoomIconName;
  label: string;
  tone?: "danger" | "active" | "off";
}) {
  return (
    <button
      type="button"
      {...props}
      className={styles.iconButton}
      data-tone={tone}
      aria-label={label}
      title={label}
    >
      <RoomIcon name={icon} />
    </button>
  );
}

const labels: Record<string, string> = {
  connected: "Đã kết nối",
  disconnected: "Chưa vào phòng",
  connecting: "Đang kết nối…",
  reconnecting: "Đang kết nối lại…",
  signalReconnecting: "Đang kết nối lại…",
};
const createChatId = () => crypto.randomUUID();

export function LearningRoomScreen({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningSession>("sessions/" + id);
  const { actor } = useUserSession();
  const background = useCameraBackground();
  const audio = useRoomAudio();
  const devices = useRoomDevices();
  const room = useLearningRoom(id, background, audio, devices);
  const previewMedia = useRoomPreview(background, audio, devices);
  const container = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayError, setDisplayError] = useState<string>();
  const [chatOpen, setChatOpen] = useState(false);
  const peerId =
    query.data &&
    (query.data.teacherId === actor.userId
      ? query.data.learnerId
      : query.data.teacherId);
  const peerProfile = useUserResource<PublicRoomProfile>(
    peerId ? "profiles/" + peerId : null,
  );
  const connectedPeerName = room.tiles.find(
    (tile) => !tile.local && tile.identity === id + ":" + peerId,
  )?.name;
  const peer = roomPerson(peerProfile.data, peerId) ?? {
    name:
      connectedPeerName && connectedPeerName !== "Người tham gia"
        ? connectedPeerName
        : "Người cùng học",
    avatarUrl: null,
  };
  const self = {
    name: actor.profile.fullName,
    avatarUrl: actor.profile.avatarUrl,
  };
  const chat = useRoomChat(
    room.room,
    peerId ? id + ":" + peerId : "",
    createChatId,
    () =>
      !!query.data &&
      Date.now() < Date.parse(query.data.endAt) &&
      ["CONFIRMED", "READY", "ONGOING"].includes(query.data.status),
  );
  const now = useClock();
  const connected = room.status === "connected";
  const connecting = [
    "connecting",
    "reconnecting",
    "signalReconnecting",
  ].includes(room.status);
  const joined = connected || room.tiles.length > 0;
  const preview: RoomTile = {
    id: "preview",
    identity: id + ":" + actor.userId,
    avatarUrl: safeRoomAvatar(self.avatarUrl),
    name: `${actor.profile.fullName} (Bạn)`,
    local: true,
    source: "camera",
    microphone: false,
    speaking: false,
  };
  const tiles = (room.tiles.length ? room.tiles : [preview]).map((tile) => ({
    ...tile,
    name: tile.local
      ? `${self.name} (Bạn)`
      : tile.identity === id + ":" + peerId
        ? peer.name
        : tile.name,
    avatarUrl: tile.local
      ? safeRoomAvatar(self.avatarUrl)
      : tile.identity === id + ":" + peerId
        ? peer.avatarUrl
        : null,
  }));
  const { room: connectedRoom, close: closeRoom } = room;

  useEffect(() => {
    if (
      connectedRoom &&
      query.data &&
      (!["CONFIRMED", "READY", "ONGOING"].includes(query.data.status) ||
        Date.now() >= Date.parse(query.data.endAt))
    )
      closeRoom();
  }, [connectedRoom, closeRoom, query.data]);

  useEffect(() => {
    const element = container.current;
    const change = () => setFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", change);
    return () => {
      document.removeEventListener("fullscreenchange", change);
      if (document.fullscreenElement === element)
        void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  async function changeSize() {
    if (document.fullscreenElement === container.current) {
      try {
        await document.exitFullscreen();
      } catch {
        setDisplayError("Chưa thể thoát toàn màn hình. Nhấn Esc rồi thử lại.");
        return;
      }
    }
    setExpanded((value) => !value);
  }

  async function toggleFullscreen() {
    setDisplayError(undefined);
    try {
      if (document.fullscreenElement === container.current)
        await document.exitFullscreen();
      else if (container.current?.requestFullscreen)
        await container.current.requestFullscreen();
      else
        setDisplayError(
          "Trình duyệt chưa hỗ trợ toàn màn hình. Bạn vẫn có thể dùng chế độ mở rộng.",
        );
    } catch {
      setDisplayError(
        "Không mở được toàn màn hình. Hãy thử lại hoặc dùng chế độ mở rộng.",
      );
    }
  }

  const joinReason =
    query.data && !joined && !connecting && !canEnterSession(query.data, now)
      ? userErrorText(409, query.data.join?.reason ?? "SESSION_NOT_JOINABLE")
      : undefined;
  const messages = [
    query.loading ? "Đang tải buổi học…" : undefined,
    query.error,
    room.error,
    room.notice,
    background.error,
    audio.error,
    background.busy
      ? "Đang chuẩn bị hiệu ứng nền… Lần đầu có thể cần tải thêm dữ liệu."
      : undefined,
    peerProfile.error
      ? "Chưa tải được tên và ảnh của người cùng học."
      : undefined,
    displayError,
    joinReason,
  ].filter(Boolean);

  return (
    <section
      ref={container}
      className={styles.room}
      data-expanded={expanded}
      data-prejoin={!joined}
      aria-label="Phòng học trực tuyến"
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.brand}>S</span>
          <div>
            <h1>
              Phòng học <span>SkillHub</span>
            </h1>
            <p>
              {query.data
                ? `${formatTime(query.data.startAt)} – ${formatTime(query.data.endAt)}`
                : "Không gian học trực tuyến 1:1"}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <RoomMediaSettings
            background={background}
            audio={audio}
            devices={devices}
            cameraTrack={
              joined
                ? room.tiles.find(
                    (tile) => tile.local && tile.source === "camera",
                  )?.track
                : previewMedia.tracks.camera
            }
            microphoneTrack={
              joined ? room.microphoneTrack : previewMedia.tracks.microphone
            }
            microphone={
              joined ? room.microphone : !!previewMedia.tracks.microphone
            }
            connected={connected}
            disabled={
              connecting || (joined ? room.mediaBusy : previewMedia.busy)
            }
            changeBackground={
              joined ? room.changeBackground : previewMedia.changeBackground
            }
            changeAudio={joined ? room.changeAudio : previewMedia.changeAudio}
            selectDevice={(kind, deviceId) =>
              joined
                ? void room.switchDevice(kind, deviceId)
                : previewMedia.select(kind, deviceId)
            }
            toggleMicrophone={() =>
              joined
                ? void room.toggle("microphone")
                : previewMedia.toggle("microphone")
            }
          />
          {!joined && (
            <IconButton
              icon="refresh"
              label="Kiểm tra trạng thái phòng"
              disabled={query.loading}
              onClick={query.reload}
            />
          )}
          <span
            className={styles.connection}
            data-connected={connected}
            role="status"
          >
            <i />
            {labels[room.status] ?? "Đang kiểm tra kết nối"}
          </span>
          <IconButton
            icon={expanded ? "collapse" : "expand"}
            label={
              expanded ? "Thu gọn phòng học về bên trái" : "Mở rộng phòng học"
            }
            aria-pressed={expanded}
            onClick={() => void changeSize()}
          />
          <IconButton
            icon={fullscreen ? "exitFullscreen" : "fullscreen"}
            label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            aria-pressed={fullscreen}
            onClick={() => void toggleFullscreen()}
          />
        </div>
      </header>

      {messages.length > 0 && (
        <div
          className={styles.messages}
          role={query.error || room.error || displayError ? "alert" : "status"}
        >
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
          {query.error && (
            <button type="button" onClick={query.reload}>
              Thử lại
            </button>
          )}
          {peerProfile.error && (
            <button type="button" onClick={peerProfile.reload}>
              Tải lại hồ sơ
            </button>
          )}
        </div>
      )}

      {!joined ? (
        <RoomPrejoin
          name={actor.profile.fullName}
          avatarUrl={actor.profile.avatarUrl}
          preview={previewMedia}
          background={background}
          audio={audio}
          connecting={connecting}
          canJoin={!!query.data && canEnterSession(query.data, now)}
          onJoin={() => {
            void room.join(previewMedia.takeTracks());
          }}
          onCancel={room.close}
        />
      ) : (
        <RoomStage
          tiles={tiles}
          participants={room.participants}
          peerName={peer.name}
        />
      )}

      <footer className={styles.footer}>
        <div className={styles.sessionInfo}>
          <strong>Buổi học trực tuyến</strong>
          <span>
            {joined
              ? `${room.participants + 1} người trong phòng`
              : "Kiểm tra thiết bị trước khi vào phòng"}
          </span>
        </div>
        {joined && (
          <div className={styles.controls} aria-label="Điều khiển phòng học">
            <IconButton
              icon={room.microphone ? "microphone" : "microphoneOff"}
              label={room.microphone ? "Tắt micro" : "Bật micro"}
              tone={room.microphone ? undefined : "off"}
              aria-pressed={room.microphone}
              disabled={
                !connected || room.mediaBusy || background.busy || audio.busy
              }
              onClick={() => void room.toggle("microphone")}
            />
            <IconButton
              icon={room.camera ? "camera" : "cameraOff"}
              label={room.camera ? "Tắt camera" : "Bật camera"}
              tone={room.camera ? undefined : "off"}
              aria-pressed={room.camera}
              disabled={
                !connected || room.mediaBusy || background.busy || audio.busy
              }
              onClick={() => void room.toggle("camera")}
            />
            <RoomBackgroundControl
              background={background}
              disabled={!connected || room.mediaBusy || audio.busy}
              onToggle={() =>
                void room.changeBackground(
                  background.enabled
                    ? { mode: "off" }
                    : { mode: "blur", blurRadius: 12 },
                )
              }
            />
            <IconButton
              icon={room.screen ? "screenOff" : "screen"}
              label={room.screen ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
              tone={room.screen ? "active" : undefined}
              aria-pressed={room.screen}
              disabled={
                !connected || room.mediaBusy || background.busy || audio.busy
              }
              onClick={() => void room.toggle("screen")}
            />
            {room.audioBlocked && (
              <IconButton
                icon="volume"
                label="Bật âm thanh"
                tone="active"
                onClick={room.startAudio}
              />
            )}
            <IconButton
              icon="phone"
              label="Rời phòng"
              tone="danger"
              onClick={() => {
                room.close();
              }}
            />
            <IconButton
              icon="chat"
              label={"Chat phiên học (" + chat.messages.length + " tin)"}
              tone={chatOpen ? "active" : undefined}
              aria-expanded={chatOpen}
              onClick={() => setChatOpen((value) => !value)}
            />
          </div>
        )}
        <Link
          href={"/learn/sessions/" + id}
          className={styles.details}
          title="Chi tiết buổi học"
        >
          <RoomIcon name="back" />
          <span>Chi tiết buổi học</span>
        </Link>
      </footer>
      {joined && (
        <RoomChat
          open={chatOpen}
          chat={chat}
          peer={peer}
          self={self}
          close={() => setChatOpen(false)}
        />
      )}
      <p className={styles.footnote}>
        Rời phòng không tự xác nhận hoàn tất buổi học. Xem điểm danh và xác nhận
        tại chi tiết buổi học.
      </p>
      <div className={styles.audio} aria-hidden="true">
        {room.audio.map(({ id, track }) => (
          <RoomTrack key={id} track={track} label="Âm thanh phòng học" />
        ))}
      </div>
    </section>
  );
}
