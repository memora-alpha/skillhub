import { useEffect, useRef } from "react";
import { TextInput, type TextInputInstance } from "react-native";
import type { ChatPasteInputProps } from "./ChatPasteInput";

export function ChatPasteInput({
  onPasteImage,
  pasteDisabled,
  ...props
}: ChatPasteInputProps) {
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    // React Native Web's TextInput ref is the underlying textarea/input element.
    const element = input.current as unknown as HTMLTextAreaElement | null;
    if (!element?.addEventListener) return;
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return; // Let the editor paste plain text at its selection.
      event.preventDefault();
      if (props.editable !== false && !pasteDisabled) onPasteImage?.({ files });
    };
    element.addEventListener("paste", paste);
    return () => element.removeEventListener("paste", paste);
  }, [onPasteImage, pasteDisabled, props.editable]);
  return <TextInput {...props} ref={input} />;
}
