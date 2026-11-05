import { useCallback, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { registerGlobals } from "@livekit/react-native";
import { RTCView } from "@livekit/react-native-webrtc";
import { createLocalVideoTrack, type LocalVideoTrack } from "livekit-client";
import { roomStyles as styles } from "./native-room.styles";
registerGlobals();

export default function NativeRoomPreview() {
  const [video, setVideo] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let generation = 0;
      let track: LocalVideoTrack | undefined;
      const stop = () => {
        generation++;
        track?.stop();
        track = undefined;
        if (alive) setVideo(null);
      };
      const start = () => {
        if (track || AppState.currentState === "background") return;
        const ticket = ++generation;
        void createLocalVideoTrack({ facingMode: "user" })
          .then((value) => {
            if (!alive || ticket !== generation) {
              value.stop();
              return;
            }
            track = value;
            setVideo(value);
            setError("");
          })
          .catch(() => {
            if (alive && ticket === generation)
              setError(
                "Chưa mở được camera. Kiểm tra quyền hoặc tắt camera để vào phòng trước.",
              );
          });
      };
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") start();
        else if (state === "background") stop();
      });
      start();
      return () => {
        alive = false;
        listener.remove();
        stop();
      };
    }, []),
  );
  const stream = video?.mediaStream as unknown as
    { toURL: () => string } | undefined;
  return (
    <View style={styles.tile}>
      {stream ? (
        <RTCView
          streamURL={stream.toURL()}
          objectFit="cover"
          mirror
          style={styles.video}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {error || "Đang chuẩn bị camera…"}
          </Text>
        </View>
      )}
      <View style={styles.tileLabel}>
        <Text style={styles.name}>Bạn · Xem trước · Chưa phát hình</Text>
      </View>
    </View>
  );
}
