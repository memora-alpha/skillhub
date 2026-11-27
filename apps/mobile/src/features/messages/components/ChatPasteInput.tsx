import type { TextInputProps } from "react-native";
import type { ChatImagePaste } from "../utils/import-pasted-chat-image";

export type ChatPasteInputProps = TextInputProps &
  Readonly<{
    onPasteImage?: (image: ChatImagePaste) => void;
    pasteDisabled?: boolean;
  }>;

export { ChatPasteInput } from "./ChatPasteInput.web";
