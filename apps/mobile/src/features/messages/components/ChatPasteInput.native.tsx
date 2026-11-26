import { requireOptionalNativeModule, requireNativeView } from "expo";
import { TextInput, type NativeSyntheticEvent } from "react-native";
import type {
  PasteEventPayload,
  TextInputWrapperViewProps,
} from "expo-paste-input";
import type { ChatPasteInputProps } from "./ChatPasteInput";

// Expo Go/older binaries retain normal text editing without importing a missing view.
type NativePasteProps = Omit<TextInputWrapperViewProps, "onPaste"> & {
  onPaste: (event: NativeSyntheticEvent<PasteEventPayload>) => void;
};
const Wrapper = requireOptionalNativeModule("ExpoPasteInput")
  ? requireNativeView<NativePasteProps>("ExpoPasteInput")
  : undefined;

export function ChatPasteInput({
  onPasteImage,
  pasteDisabled,
  style,
  ...props
}: ChatPasteInputProps) {
  if (!Wrapper) return <TextInput {...props} style={style} />;
  return (
    <Wrapper
      style={{ flex: 1, minWidth: 0 }}
      onPaste={({ nativeEvent: payload }) => {
        // Text is already inserted by the native editor. Never append it twice.
        if (
          payload.type === "images" &&
          props.editable !== false &&
          !pasteDisabled
        )
          onPasteImage?.({ uris: payload.uris });
      }}
    >
      <TextInput {...props} style={[style, { flex: 0, width: "100%" }]} />
    </Wrapper>
  );
}
