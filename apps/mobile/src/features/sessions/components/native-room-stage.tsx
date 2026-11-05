import { useState } from "react";
import {
  ScrollView,
  Text,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import {
  VideoTrack,
  useTracks,
  useRemoteParticipants,
  isTrackReference,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { roomStyles as styles } from "./native-room.styles";

export function NativeRoomStage({
  partnerName,
  partnerAvatarUrl,
  expanded,
}: Readonly<{
  partnerName: string;
  partnerAvatarUrl?: string | null;
  expanded: boolean;
}>) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );
  const remote = useRemoteParticipants();
  const [pinned, setPinned] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const { height, width } = useWindowDimensions();
  const id = (track: (typeof tracks)[number]) =>
    track.participant.identity + ":" + track.source;
  const main =
    tracks.find((track) => id(track) === pinned) ??
    tracks.find(
      (track) =>
        track.source === Track.Source.ScreenShare && !track.participant.isLocal,
    ) ??
    tracks.find((track) => track.source === Track.Source.ScreenShare) ??
    tracks.find((track) => !track.participant.isLocal) ??
    tracks[0];
  const stageHeight = expanded
    ? Math.max(180, Math.min(height * 0.5, width * 0.65))
    : Math.min(320, width * 0.7);

  let stageLabel: string;
  if (main?.source === Track.Source.ScreenShare)
    stageLabel = "Đang chia sẻ màn hình";
  else if (remote.length) stageLabel = "Học cùng nhau";
  else stageLabel = "Đang chờ " + partnerName + " vào phòng";
  return (
    <View style={styles.grid}>
      <View style={styles.stageBar}>
        <Icon
          name={
            main?.source === Track.Source.ScreenShare ? "screen-share" : "users"
          }
          color="#bdc1c6"
          size={18}
        />
        <Text style={styles.status}>{stageLabel}</Text>
      </View>
      {main && (
        <NativeRoomTile
          track={main}
          primary
          stageHeight={stageHeight}
          partnerName={partnerName}
          partnerAvatarUrl={partnerAvatarUrl}
        />
      )}
      {tracks.length > 1 && (
        <View style={styles.controlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? "Mở dải người tham gia" : "Thu gọn dải người tham gia"
            }
            accessibilityState={{ expanded: !hidden }}
            onPress={() => setHidden((value) => !value)}
            style={[
              styles.textButton,
              { flexDirection: "row", alignItems: "center", gap: 8 },
            ]}
          >
            <View
              style={{ transform: [{ rotate: hidden ? "-90deg" : "90deg" }] }}
            >
              <Icon name="chevron" color="#f1f3f4" size={18} />
            </View>
            <Text style={styles.placeholderText}>
              {hidden ? "Hiện màn hình thu nhỏ" : "Ẩn màn hình thu nhỏ"}
            </Text>
          </Pressable>
          {pinned && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPinned(null)}
              style={styles.textButton}
            >
              <Text style={styles.placeholderText}>
                Bỏ ghim · Tự ưu tiên màn hình chia sẻ
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {!hidden && tracks.length > 1 && (
        <ScrollView horizontal contentContainerStyle={styles.thumbnails}>
          {tracks.map((track) => (
            <Pressable
              key={id(track)}
              accessibilityRole="button"
              accessibilityLabel={
                track.participant.isLocal
                  ? "Ghim màn hình của bạn"
                  : "Ghim màn hình của " + partnerName
              }
              accessibilityState={{ selected: main && id(main) === id(track) }}
              onPress={() => setPinned(id(track) === pinned ? null : id(track))}
              style={
                main && id(main) === id(track) ? styles.selectedTile : undefined
              }
            >
              {
                <NativeRoomTile
                  track={track}
                  primary={false}
                  stageHeight={stageHeight}
                  partnerName={partnerName}
                  partnerAvatarUrl={partnerAvatarUrl}
                />
              }
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function NativeRoomTile({
  track,
  primary,
  stageHeight,
  partnerName,
  partnerAvatarUrl,
}: Readonly<{
  track: ReturnType<typeof useTracks>[number];
  primary: boolean;
  stageHeight: number;
  partnerName: string;
  partnerAvatarUrl?: string | null;
}>) {
  const name = track.participant.isLocal ? "Bạn" : partnerName;
  const avatar = track.participant.isLocal ? undefined : partnerAvatarUrl;
  const screen = track.source === Track.Source.ScreenShare;
  return (
    <View style={[styles.tile, !primary && styles.thumbnail]}>
      {isTrackReference(track) && !track.publication.isMuted ? (
        <VideoTrack
          trackRef={track}
          style={{ width: "100%", height: primary ? stageHeight : 92 }}
          objectFit={screen ? "contain" : "cover"}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              minHeight: primary ? stageHeight : 92,
              padding: primary ? 24 : 8,
              paddingBottom: primary ? 48 : 32,
            },
          ]}
        >
          <Avatar name={name} sourceUri={avatar} size={primary ? 72 : 36} />
          {primary && (
            <Text style={styles.placeholderText}>Camera đang tắt</Text>
          )}
        </View>
      )}
      <View style={styles.tileLabel}>
        <Avatar name={name} sourceUri={avatar} size={20} />
        <Text numberOfLines={1} style={styles.name}>
          {name}
          {screen ? " · Màn hình" : ""}
        </Text>
        <Icon
          name={
            track.participant.isMicrophoneEnabled
              ? "microphone"
              : "microphone-off"
          }
          color="#f1f3f4"
          size={16}
        />
      </View>
    </View>
  );
}
