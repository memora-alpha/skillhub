import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";
import {
  LocalAudioTrack,
  RemoteAudioTrack,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
} from "livekit-client";
import {
  defaultNativeAudioSettings,
  nativeAudioCapture,
  setNativeMicrophoneGain,
  configureNativeMicrophone,
  type NativeAudioSettings,
} from "../utils/native-audio-settings";

export function useNativeMediaSettings(
  room: Room | null,
  active: () => boolean,
) {
  const [settings, setSettings] = useState(defaultNativeAudioSettings);
  const [volume, setVolume] = useState(1);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [output, setOutput] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef(false);
  const generation = useRef(0);
  const latest = useRef({ settings, volume, active, room });
  latest.current = { settings, volume, active, room };
  useEffect(() => {
    if (!room) return;
    let mounted = true;
    flight.current = false;
    setPending(false);
    setError("");
    room.options.audioCaptureDefaults = {
      ...room.options.audioCaptureDefaults,
      ...nativeAudioCapture(latest.current.settings),
    };
    const current = () =>
      mounted && latest.current.room === room && latest.current.active();
    let microphone: LocalAudioTrack | undefined;
    const gain = () => {
      if (!current() || !microphone) return;
      const settings = latest.current.settings;
      setNativeMicrophoneGain(
        microphone.mediaStreamTrack,
        settings.autoGainControl ? 1 : settings.microphoneGain,
        Platform.OS,
      );
    };
    const published = () => {
      microphone?.off(TrackEvent.Restarted, gain);
      const track = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      )?.track;
      microphone = track instanceof LocalAudioTrack ? track : undefined;
      microphone?.on(TrackEvent.Restarted, gain);
      gain();
    };
    const subscribed = (track: Track) => {
      if (current() && track instanceof RemoteAudioTrack)
        track.setVolume(latest.current.volume);
    };
    room.on(RoomEvent.LocalTrackPublished, published);
    room.on(RoomEvent.TrackSubscribed, subscribed);
    published();
    void AudioSession.getAudioOutputs()
      .then((items) => {
        if (current()) setOutputs(items);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      generation.current++;
      microphone?.off(TrackEvent.Restarted, gain);
      room.off(RoomEvent.LocalTrackPublished, published);
      room.off(RoomEvent.TrackSubscribed, subscribed);
    };
  }, [room]);

  async function perform(
    work: (current: () => boolean) => Promise<void> | void,
  ) {
    if (flight.current || !room || !latest.current.active()) return;
    const attempt = generation.current;
    const current = () =>
      attempt === generation.current &&
      latest.current.room === room &&
      latest.current.active();
    flight.current = true;
    setPending(true);
    setError("");
    try {
      await work(current);
    } catch {
      if (current())
        setError(
          "Chưa áp dụng được cài đặt. Kiểm tra thiết bị và thử lại; micro có thể cần được bật lại.",
        );
    } finally {
      if (attempt === generation.current) flight.current = false;
      if (current()) setPending(false);
    }
  }
  return {
    settings,
    volume,
    outputs,
    output,
    pending,
    error,
    manualGain: Platform.OS === "ios",
    change: (next: NativeAudioSettings) =>
      perform(async (current) => {
        if (!room) return;
        const track = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;
        const capture = nativeAudioCapture(next);
        const configured = await configureNativeMicrophone(
          track instanceof LocalAudioTrack ? track : undefined,
          latest.current.settings,
          next,
          Platform.OS,
          current,
        );
        if (!configured || !current()) return;
        room.options.audioCaptureDefaults = {
          ...room.options.audioCaptureDefaults,
          ...capture,
        };
        latest.current.settings = next;
        setSettings(next);
      }),
    changeVolume: (next: number) =>
      perform(() => {
        if (!room || !Number.isFinite(next) || next < 0 || next > 1) return;
        for (const participant of room.remoteParticipants.values())
          for (const publication of participant.audioTrackPublications.values())
            if (publication.track instanceof RemoteAudioTrack)
              publication.track.setVolume(next);
        latest.current.volume = next;
        setVolume(next);
      }),
    changeOutput: (device: string) =>
      perform(async (current) => {
        const available = await AudioSession.getAudioOutputs();
        if (!current()) return;
        setOutputs(available);
        if (!available.includes(device))
          throw new Error("AUDIO_OUTPUT_UNAVAILABLE");
        await AudioSession.selectAudioOutput(device);
        if (current()) setOutput(device);
      }),
  };
}
