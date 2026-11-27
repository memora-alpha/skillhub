import { useCallback, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import ImageView from "react-native-image-viewing";
import { useSafeAreaPosition } from "@/components/use-safe-area-position";
import { useNativeChatImage } from "../hooks/use-native-chat-image";
import {
  ChatImageFeedback,
  ChatViewerToolbar,
  chatViewerBackground,
  chatViewerToolbarHeight,
  type ChatImageViewerProps,
} from "./ChatImageViewerBase";

export function ChatImageViewer(props: ChatImageViewerProps) {
  const decoded = useNativeChatImage(props.uri, !props.error, props.onError);
  const display = { ...props, error: props.error ?? decoded.error };
  const latest = useRef(display);
  latest.current = display;
  // Measure outside the modal once. Loading or download updates cannot move it.
  const position = useSafeAreaPosition({ top: 0, left: 0, right: 0 });
  const [placement] = useState(() => ({
    padding: {
      paddingTop: position.top,
      paddingLeft: position.left,
      paddingRight: position.right,
    },
    height:
      chatViewerToolbarHeight +
      (typeof position.top === "number" ? position.top : 0),
  }));
  const { height } = useWindowDimensions();
  const header = useCallback(
    () => (
      <ChatViewerToolbar
        {...latest.current}
        safeAreaPadding={placement.padding}
      />
    ),
    [placement],
  );
  const feedback = useCallback(() => {
    const current = latest.current;
    if (current.uri && !current.error && decoded.ready) return null;
    return (
      <View style={{ height: Math.max(0, height - placement.height) }}>
        <ChatImageFeedback {...current} />
      </View>
    );
  }, [height, placement, decoded.ready]);
  return (
    <ImageView
      images={
        props.uri && !display.error && decoded.ready
          ? [{ uri: props.uri, headers: {}, cache: "reload" }]
          : []
      }
      imageIndex={0}
      visible
      onRequestClose={props.onClose}
      doubleTapToZoomEnabled
      swipeToCloseEnabled
      animationType="none"
      backgroundColor={chatViewerBackground}
      HeaderComponent={header}
      FooterComponent={feedback}
    />
  );
}
