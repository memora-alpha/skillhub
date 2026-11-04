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
}: {
  partnerName: string;
  partnerAvatarUrl?: string | null;
  expanded: boolean;
}) {
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
  function tile(track: (typeof tracks)[number], primary: boolean) {
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
              { minHeight: primary ? stageHeight : 92 },
            ]}
          >
            <Avatar
              name={track.participant.isLocal ? "Bạn" : partnerName}
              sourceUri={
                track.participant.isLocal ? undefined : partnerAvatarUrl
              }
              size={primary ? 72 : 36}
            />
            <Text style={styles.placeholderText}>Camera đang tắt</Text>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 10,
          }}
        >
          <Avatar
            name={track.participant.isLocal ? "Bạn" : partnerName}
            sourceUri={track.participant.isLocal ? undefined : partnerAvatarUrl}
            size={24}
          />
          <Text numberOfLines={2} style={[styles.name, { flex: 1 }]}>
            {track.participant.isLocal ? "Bạn" : partnerName}
            {screen ? " · Màn hình" : ""}
            {track.participant.isMicrophoneEnabled ? "" : " · Tắt micro"}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      <Text style={styles.status}>
        {main?.source === Track.Source.ScreenShare
          ? "Đang chia sẻ màn hình"
          : remote.length
            ? "Học cùng nhau"
            : "Đang chờ " + partnerName + " vào phòng"}
      </Text>
      {main && tile(main, true)}
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
              onPress={() => setPinned(id(track))}
            >
              {tile(track, false)}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
