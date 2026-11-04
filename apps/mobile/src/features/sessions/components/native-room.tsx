import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Text,
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  RoomContext,
  useLocalParticipant,
  registerGlobals,
} from "@livekit/react-native";
import { LocalVideoTrack, Track } from "livekit-client";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useRoomConnection } from "../hooks/use-room-connection.native";
import type { RoomMediaProps } from "./room-media.types";
import { roomStyles as styles } from "./native-room.styles";
import { SafeAreaView } from "@/components/SafeArea";
import { randomUUID } from "expo-crypto";
import { NativeRoomStage } from "./native-room-stage";
import { NativeRoomChat } from "./native-room-chat";
import { useRoomChat } from "../hooks/use-room-chat";

registerGlobals();

export default function NativeRoom(props: RoomMediaProps) {
  const call = useRoomConnection(props);
  const [expanded, setExpanded] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useRoomChat(
    call.room,
    props.partnerIdentity,
    randomUUID,
    call.active,
  );
  const labels = {
    connecting: "Đang kết nối phòng học…",
    connected: "Đã vào phòng học",
    reconnecting: "Mất kết nối. Đang kết nối lại…",
    disconnected: "Đã ngắt kết nối",
  };
  const content = (
    <View style={styles.page}>
      <Button variant="paper" onPress={() => setExpanded((value) => !value)}>
        {expanded ? "Thu gọn phòng học" : "Mở rộng phòng học"}
      </Button>
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
          <NativeRoomStage
            partnerName={props.partnerName}
            partnerAvatarUrl={props.partnerAvatarUrl}
            expanded={expanded}
          />
          <RoomControls call={call} onLeave={props.onLeave} />
          <Button
            variant="paper"
            onPress={() => setChatOpen((value) => !value)}
          >
            {(chatOpen ? "Đóng chat" : "Chat phiên học") +
              " (" +
              chat.messages.length +
              ")"}
          </Button>
          <NativeRoomChat
            chat={chat}
            partnerName={props.partnerName}
            partnerAvatarUrl={props.partnerAvatarUrl}
            hidden={!chatOpen}
          />
        </RoomContext.Provider>
      )}
      {call.status === "disconnected" && (
        <Button disabled={props.retrying} onPress={props.onRetry}>
          {props.retrying ? "Đang kiểm tra phòng…" : "Kết nối lại"}
        </Button>
      )}
    </View>
  );
  if (!expanded) return content;
  return (
    <Modal
      visible
      onRequestClose={() => setExpanded(false)}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaView style={styles.fullscreen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.fullscreenContent}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function RoomControls({
  call,
  onLeave,
}: Readonly<{
  call: ReturnType<typeof useRoomConnection>;
  onLeave: () => void;
}>) {
  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
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
      {Platform.OS === "android" && (
        <Button
          variant="paper"
          disabled={disabled}
          onPress={() => {
            void perform(() =>
              localParticipant.setScreenShareEnabled(!isScreenShareEnabled),
            );
          }}
        >
          {isScreenShareEnabled ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        </Button>
      )}
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
