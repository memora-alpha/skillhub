import { useEffect } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import { classroomStyles as styles } from "./classroom.styles";

export default function RecordingVideo({
  url,
  startAt,
  onProgress,
  onError,
}: Readonly<{
  url: string;
  startAt: number;
  onProgress: (seconds: number) => void;
  onError: () => void;
}>) {
  const player = useVideoPlayer({ uri: url, useCaching: false }, (instance) => {
    instance.loop = false;
    instance.allowsExternalPlayback = false;
    instance.staysActiveInBackground = false;
    instance.timeUpdateEventInterval = 1;
    instance.currentTime = startAt;
  });
  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "error") onError();
    });
    const progress = player.addListener("timeUpdate", ({ currentTime }) =>
      onProgress(currentTime),
    );
    return () => {
      subscription.remove();
      progress.remove();
    };
  }, [player, onError, onProgress]);
  return (
    <VideoView
      player={player}
      style={styles.player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture={false}
    />
  );
}
