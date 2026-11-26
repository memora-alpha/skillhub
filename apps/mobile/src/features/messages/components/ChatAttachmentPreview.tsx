import { StyleSheet, View } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { filePickerError } from "@/lib/http/file-picker-error";
import type { useChatAttachment } from "../hooks/use-chat-attachment";
import { ChatAttachmentTile } from "./ChatAttachmentTile";
import { attachmentCopy } from "../utils/chat-attachment-kind";

export function ChatAttachmentPreview({
  attachment,
  inComposer = false,
}: Readonly<{
  attachment: ReturnType<typeof useChatAttachment>;
  inComposer?: boolean;
}>) {
  if (!attachment.file && !attachment.error) return null;
  return (
    <View
      style={[
        styles.preview,
        inComposer && !!attachment.file && styles.inComposer,
      ]}
    >
      {attachment.file && (
        <ChatAttachmentTile
          file={attachment.file}
          locked={attachment.locked}
          onRemove={attachment.remove}
        />
      )}
      {attachment.file && attachment.preparing && (
        <FormNotice tone="info" compact>
          Đang chuẩn bị ảnh…
        </FormNotice>
      )}
      {!!attachment.error && (
        <FormNotice tone="error" compact>
          {attachmentCopy(
            filePickerError(attachment.error, "selection"),
            attachment.errorSource !== "files" ? "image/jpeg" : undefined,
          )}
        </FormNotice>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  preview: { gap: 8 },
  inComposer: { paddingLeft: 50 },
});
