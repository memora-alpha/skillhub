"use client";
import Link from "next/link";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { useClock } from "../hooks/use-clock";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import type { Identity, LearningSession } from "../types";
import { formatTime } from "../components/common";
import { canEnterSession } from "../sessions/session-policy";
import { userErrorText, UserApiError } from "../api/client";
import { useLearningRoom } from "./use-learning-room";
import type { RoomTile } from "./room-media";
import { RoomStage } from "./room-stage";
import {
  roomPerson,
  safeRoomAvatar,
  type PublicRoomProfile,
  type RoomPerson,
} from "./room-profiles";
import { RoomIcon, type RoomIconName } from "./room-icon";
import { RoomTrack } from "./room-track";
import { RoomPrejoin } from "./room-prejoin";
import { useRoomPreview } from "./use-room-preview";
import { useCameraBackground } from "./use-camera-background";
import { useRoomAudio } from "./use-room-audio";
import { useRoomDevices } from "./use-room-devices";
import { RoomMediaSettings } from "./room-media-settings";
import { useRoomChat } from "./use-room-chat";
import { RoomChat } from "./room-chat";
import { useRoomWhiteboard } from "./use-room-whiteboard";
import { WhiteboardCanvas } from "./whiteboard-canvas";
import { useRoomRecording } from "./use-room-recording";
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

function useRoomPeople(
  id: string,
  actor: Identity,
  session: LearningSession | undefined,
  tiles: RoomTile[],
) {
  const peerId =
    session &&
    (session.teacherId === actor.userId
      ? session.learnerId
      : session.teacherId);
  const peerProfile = useUserResource<PublicRoomProfile>(
    peerId ? "profiles/" + peerId : null,
  );
  const connectedPeerName = tiles.find(
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
  return { peerId, peerProfile, peer, self };
}

function participantTiles(
  id: string,
  actor: Identity,
  roomTiles: RoomTile[],
  peerId: string | undefined,
  peer: RoomPerson,
) {
  const preview: RoomTile = {
    id: "preview",
    identity: id + ":" + actor.userId,
    avatarUrl: safeRoomAvatar(actor.profile.avatarUrl),
    name: `${actor.profile.fullName} (Bạn)`,
    local: true,
    source: "camera",
    microphone: false,
    speaking: false,
  };
  const tiles = (roomTiles.length ? roomTiles : [preview]).map((tile) => {
    if (tile.local)
      return {
        ...tile,
        name: `${actor.profile.fullName} (Bạn)`,
        avatarUrl: safeRoomAvatar(actor.profile.avatarUrl),
      };
    if (tile.identity === id + ":" + peerId)
      return { ...tile, name: peer.name, avatarUrl: peer.avatarUrl };
    return { ...tile, avatarUrl: null };
  });
  return tiles;
}

function RoomControls({
  room,
  background,
  audio,
  chatOpen,
  chatCount,
  onToggleChat,
  whiteboardOpen,
  onToggleWhiteboard,
  recording,
}: Readonly<{
  room: ReturnType<typeof useLearningRoom>;
  background: ReturnType<typeof useCameraBackground>;
  audio: ReturnType<typeof useRoomAudio>;
  chatOpen: boolean;
  chatCount: number;
  onToggleChat: () => void;
  whiteboardOpen: boolean;
  onToggleWhiteboard: () => void;
  recording: ReturnType<typeof useRoomRecording>;
}>) {
  const connected = room.status === "connected";
  const canStopRecording =
    recording.active &&
    ["STARTING", "RECORDING"].includes(recording.active.status);
  const recordingLabel = canStopRecording
    ? "Dừng ghi hình buổi học"
    : recording.waitingForPartner
      ? "Đang chờ đối phương đồng ý ghi hình"
      : "Yêu cầu ghi hình buổi học";
  return (
    <div className={styles.controls} aria-label="Điều khiển phòng học">
      <IconButton
        icon={room.microphone ? "microphone" : "microphoneOff"}
        label={room.microphone ? "Tắt micro" : "Bật micro"}
        tone={room.microphone ? undefined : "off"}
        aria-pressed={room.microphone}
        disabled={!connected || room.mediaBusy || background.busy || audio.busy}
        onClick={() => void room.toggle("microphone")}
      />
      <IconButton
        icon={room.camera ? "camera" : "cameraOff"}
        label={room.camera ? "Tắt camera" : "Bật camera"}
        tone={room.camera ? undefined : "off"}
        aria-pressed={room.camera}
        disabled={!connected || room.mediaBusy || background.busy || audio.busy}
        onClick={() => void room.toggle("camera")}
      />
      <IconButton
        icon={room.screen ? "screenOff" : "screen"}
        label={room.screen ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        tone={room.screen ? "active" : undefined}
        aria-pressed={room.screen}
        disabled={!connected || room.mediaBusy || background.busy || audio.busy}
        onClick={() => void room.toggle("screen")}
      />
      <IconButton
        icon="whiteboard"
        label={whiteboardOpen ? "Ẩn bảng trắng" : "Mở bảng trắng"}
        tone={whiteboardOpen ? "active" : undefined}
        aria-pressed={whiteboardOpen}
        disabled={!connected}
        onClick={onToggleWhiteboard}
      />
      <IconButton
        icon="record"
        label={recordingLabel}
        tone={
          recording.isRecording || canStopRecording
            ? "danger"
            : recording.waitingForPartner
              ? "active"
              : undefined
        }
        aria-pressed={recording.isRecording || Boolean(canStopRecording)}
        disabled={
          !connected ||
          recording.busy ||
          Boolean(recording.waitingForPartner) ||
          Boolean(recording.pendingConsentForMe) ||
          recording.active?.status === "STOPPING"
        }
        onClick={() => {
          if (canStopRecording && recording.active) {
            void recording.stopRecording(recording.active.id);
          } else {
            void recording.requestRecording();
          }
        }}
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
        label={"Chat phiên học (" + chatCount + " tin)"}
        tone={chatOpen ? "active" : undefined}
        aria-expanded={chatOpen}
        onClick={onToggleChat}
      />
    </div>
  );
}

function roomJoinReason(
  session: LearningSession | undefined,
  joined: boolean,
  connecting: boolean,
  now: number,
) {
  if (!session || joined || connecting || canEnterSession(session, now))
    return undefined;
  return userErrorText(409, session.join?.reason ?? "SESSION_NOT_JOINABLE");
}

function RoomNotices({
  query,
  room,
  background,
  audio,
  peerProfile,
  displayError,
  joinReason,
  extraError,
  extraNotice,
}: Readonly<{
  query: { initialLoading: boolean; error?: string; reload: () => void };
  room: Pick<ReturnType<typeof useLearningRoom>, "error" | "notice">;
  background: Pick<ReturnType<typeof useCameraBackground>, "error" | "busy">;
  audio: Pick<ReturnType<typeof useRoomAudio>, "error">;
  peerProfile: { error?: string; reload: () => void };
  displayError?: string;
  joinReason?: string;
  extraError?: string;
  extraNotice?: string;
}>) {
  const messages = [
    query.error,
    room.error,
    room.notice,
    background.error,
    audio.error,
    peerProfile.error
      ? "Chưa tải được tên và ảnh của người cùng học."
      : undefined,
    displayError,
    joinReason,
    extraError,
    extraNotice,
  ].filter(Boolean);

  if (!messages.length && !query.initialLoading && !background.busy)
    return null;
  const hasError = !!(query.error || room.error || displayError || extraError);
  return (
    <div className={styles.messages} role={hasError ? "alert" : undefined}>
      {query.initialLoading && !query.error && (
        <LoadingSkeleton variant="inline" label="Đang tải buổi học" />
      )}
      {background.busy && (
        <LoadingSkeleton variant="inline" label="Đang chuẩn bị hiệu ứng nền" />
      )}
      {[...new Set(messages)].map((message) => (
        <p key={message}>{hasError ? message : <output>{message}</output>}</p>
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
  );
}

export function LearningRoomScreen({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningSession>("sessions/" + id, {
    refetchInterval: () => 15000,
  });
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
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const { peerId, peerProfile, peer, self } = useRoomPeople(
    id,
    actor,
    query.data,
    room.tiles,
  );
  const peerIdentity = peerId ? id + ":" + peerId : "";
  const chat = useRoomChat(
    room.room,
    peerIdentity,
    createChatId,
    () => !!query.data && canEnterSession(query.data),
  );
  const now = useClock();
  const connected = room.status === "connected";
  const connecting = [
    "connecting",
    "reconnecting",
    "signalReconnecting",
  ].includes(room.status);
  const joined = connected || room.tiles.length > 0;
  const whiteboard = useRoomWhiteboard({
    sessionId: id,
    enabled: joined && whiteboardOpen,
    room: room.room,
    peerIdentity,
    onRemoteToggle: (open) => setWhiteboardOpen(open),
  });
  const recording = useRoomRecording(id, room.room, joined);
  const tiles = participantTiles(id, actor, room.tiles, peerId, peer);
  const { room: connectedRoom, close: closeRoom } = room;

  useEffect(() => {
    if (
      connectedRoom &&
      ((query.data && !canEnterSession(query.data)) ||
        (query.failure instanceof UserApiError &&
          [401, 403, 404].includes(query.failure.status)))
    )
      closeRoom();
  }, [connectedRoom, closeRoom, query.data, query.failure]);

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

  const joinReason = roomJoinReason(query.data, joined, connecting, now);

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
          {recording.isRecording && (
            <div
              className={styles.recordingPill}
              role="status"
              aria-live="polite"
            >
              <span className={styles.recordingDot} aria-hidden="true" />
              Đang ghi hình
            </div>
          )}
          <div className={styles.connection} data-connected={connected}>
            {connecting ? (
              <LoadingSkeleton variant="inline" label={labels[room.status]} />
            ) : (
              <output>
                <i />
                {labels[room.status] ?? "Chưa có thông tin kết nối"}
              </output>
            )}
          </div>
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

      <RoomNotices
        query={query}
        room={room}
        background={background}
        audio={audio}
        peerProfile={peerProfile}
        displayError={displayError}
        joinReason={joinReason}
        extraError={whiteboard.error ?? recording.error}
        extraNotice={recording.notice}
      />

      {joined && recording.pendingConsentForMe && (
        <div
          className={styles.consentBar}
          role="alertdialog"
          aria-label="Yêu cầu đồng ý ghi hình"
        >
          <span>
            Đối phương đang yêu cầu ghi hình buổi học. Bản ghi dùng để xem lại
            kiến thức học tập và làm bằng chứng nếu phát sinh báo cáo tranh
            chấp.
          </span>
          <div className={styles.consentActions}>
            <button
              type="button"
              className={styles.consentBtn}
              data-primary="true"
              disabled={recording.busy}
              onClick={() =>
                void recording.acceptRecording(
                  recording.pendingConsentForMe!.id,
                )
              }
            >
              Đồng ý ghi hình
            </button>
            <button
              type="button"
              className={styles.consentBtn}
              disabled={recording.busy}
              onClick={() =>
                void recording.declineRecording(
                  recording.pendingConsentForMe!.id,
                )
              }
            >
              Từ chối
            </button>
          </div>
        </div>
      )}

      {joined && recording.waitingForPartner && (
        <div className={styles.consentBar} role="status">
          <span>
            Đang chờ đối phương xác nhận đồng ý ghi hình (yêu cầu tự hết hạn sau
            2 phút).
          </span>
        </div>
      )}

      {!joined ? (
        <RoomPrejoin
          session={query.data}
          name={actor.profile.fullName}
          onRetryDevices={() => {
            void devices.refresh();
            query.reload();
          }}
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
      ) : whiteboardOpen ? (
        <div className={styles.stageWithBoard}>
          <div className={styles.boardPane}>
            <WhiteboardCanvas
              elements={whiteboard.elements}
              readOnly={whiteboard.readOnly}
              readOnlyNotice={whiteboard.readOnlyNotice}
              statusText={whiteboard.statusText}
              onMutate={whiteboard.readOnly ? undefined : whiteboard.mutate}
              onSaveNow={whiteboard.readOnly ? undefined : whiteboard.saveNow}
              saving={whiteboard.saving}
              onClose={() => {
                setWhiteboardOpen(false);
                whiteboard.notifyToggle(false);
              }}
            />
          </div>
          <RoomStage
            tiles={tiles}
            participants={room.participants}
            peerName={peer.name}
          />
        </div>
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
          <RoomControls
            room={room}
            background={background}
            audio={audio}
            chatOpen={chatOpen}
            chatCount={chat.messages.length}
            onToggleChat={() => setChatOpen((value) => !value)}
            whiteboardOpen={whiteboardOpen}
            onToggleWhiteboard={() => {
              const next = !whiteboardOpen;
              setWhiteboardOpen(next);
              whiteboard.notifyToggle(next);
            }}
            recording={recording}
          />
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
