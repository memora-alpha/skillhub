import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import {
  RoomContext,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  registerGlobals,
  isTrackReference,
} from "@livekit/react-native";
import { LocalVideoTrack, Track } from "livekit-client";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { useRoomConnection } from "../hooks/use-room-connection.native";
import type { RoomMediaProps } from "./room-media.types";
import { roomStyles as styles } from "./native-room.styles";

registerGlobals();

export default function NativeRoom(props: RoomMediaProps) {
  const call = useRoomConnection(props);
  const labels = {
    connecting: "Đang kết nối phòng học…",
    connected: "Đã vào phòng học",
    reconnecting: "Mất kết nối. Đang kết nối lại…",
    disconnected: "Đã ngắt kết nối",
  };
  return (
    <View style={styles.page}>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {labels[call.status]}
      </Text>
      {(call.status === "connecting" || call.status === "reconnecting") && (
        <ActivityIndicator accessibilityLabel={labels[call.status]} />
      )}
      {!!call.error && <FormNotice tone="error">{call.error}</FormNotice>}
      {!!call.mediaNotice && (
        <FormNotice tone="info">{call.mediaNotice}</FormNotice>
      )}
      {!!call.mediaNotice && (
        <Button
          variant="paper"
          onPress={() => {
            void Linking.openSettings().catch(call.mediaFailed);
          }}
        >
          Cài đặt quyền camera / micro
        </Button>
      )}
      {call.room && (
        <RoomContext.Provider value={call.room}>
          <RoomVideos partnerName={props.partnerName} />
          <RoomControls call={call} onLeave={props.onLeave} />
        </RoomContext.Provider>
      )}
      {call.status === "disconnected" && (
        <Button disabled={props.retrying} onPress={props.onRetry}>
          {props.retrying ? "Đang kiểm tra phòng…" : "Kết nối lại"}
        </Button>
      )}
    </View>
  );
}

function RoomVideos({ partnerName }: Readonly<{ partnerName: string }>) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: true },
  );
  const remote = useRemoteParticipants();
  return (
    <View style={styles.grid}>
      {remote.length === 0 && (
        <View style={styles.tile}>
          <View style={styles.placeholder}>
            <Icon name="user" color={appColors.white} size={42} />
            <Text style={styles.placeholderText}>
              Đang chờ {partnerName} vào phòng
            </Text>
          </View>
        </View>
      )}
      {tracks.map((track) => (
        <View
          key={`${track.participant.identity}:${track.source}`}
          style={styles.tile}
        >
          {isTrackReference(track) && !track.publication.isMuted ? (
            <VideoTrack
              trackRef={track}
              style={styles.video}
              objectFit="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Icon name="video" color={appColors.white} size={36} />
              <Text style={styles.placeholderText}>Camera đang tắt</Text>
            </View>
          )}
          <Text style={styles.name}>
            {track.participant.isLocal ? "Bạn" : partnerName}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RoomControls({
  call,
  onLeave,
}: Readonly<{
  call: ReturnType<typeof useRoomConnection>;
  onLeave: () => void;
}>) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const disabled = pending || call.mediaPending || call.status !== "connected";
  async function perform(work: () => Promise<unknown>) {
    if (busy.current || !call.active() || disabled) return;
    busy.current = true;
    setPending(true);
    try {
      await work();
      if (call.active()) call.mediaSucceeded();
      else localParticipant.trackPublications.forEach((p) => p.track?.stop());
    } catch {
      if (call.active()) call.mediaFailed();
    } finally {
      busy.current = false;
      if (call.active()) setPending(false);
    }
  }
  return (
    <View style={styles.controls}>
      <View style={styles.controlRow}>
        <Button
          variant="paper"
          style={styles.control}
          disabled={disabled}
          onPress={() => {
            void perform(() =>
              localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
            );
          }}
        >
          {isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
        </Button>
        <Button
          variant="paper"
          style={styles.control}
          disabled={disabled}
          onPress={() => {
            void perform(() =>
              localParticipant.setCameraEnabled(!isCameraEnabled),
            );
          }}
        >
          {isCameraEnabled ? "Tắt camera" : "Bật camera"}
        </Button>
      </View>
      <Button
        variant="paper"
        disabled={disabled || !isCameraEnabled}
        onPress={() => {
          void perform(async () => {
            const track = localParticipant.getTrackPublication(
              Track.Source.Camera,
            )?.track;
            if (!(track instanceof LocalVideoTrack)) return;
            const next = facing === "user" ? "environment" : "user";
            await track.restartTrack({ facingMode: next });
            if (call.active()) setFacing(next);
          });
        }}
      >
        Đổi camera trước / sau
      </Button>
      <Button
        style={styles.leave}
        onPress={() => {
          call.close();
          onLeave();
        }}
      >
        Rời phòng học
      </Button>
    </View>
  );
}
