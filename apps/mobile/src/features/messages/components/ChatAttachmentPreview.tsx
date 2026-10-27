import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import type { useChatAttachment } from "../hooks/use-chat-attachment";
import { ChatAttachmentTile } from "./ChatAttachmentTile";

const fileProblems: Readonly<
  Record<string, { label: string; message: string }>
> = {
  REJECTED: {
    label: "Tệp bị từ chối",
    message: "Tệp không vượt qua kiểm tra. Hãy bỏ tệp và chọn tệp khác.",
  },
  SCAN_FAILED: {
    label: "Kiểm tra tệp thất bại",
    message: "Không thể kiểm tra tệp. Hãy bỏ tệp và chọn lại.",
  },
  UPLOAD_FAILED: {
    label: "Tải tệp lên thất bại",
    message: "Tải tệp lên không thành công. Hãy bỏ tệp và chọn lại.",
  },
  CLEANUP_PENDING: {
    label: "Tệp không còn khả dụng",
    message: "Tệp không còn khả dụng. Hãy bỏ tệp và chọn lại.",
  },
  DELETED: {
    label: "Tệp đã bị xóa",
    message: "Tệp đã bị xóa. Hãy bỏ tệp và chọn lại.",
  },
};

export function ChatAttachmentPreview({
  attachment,
  onRecovered,
  inComposer = false,
}: Readonly<{
  attachment: ReturnType<typeof useChatAttachment>;
  onRecovered: (text: string) => void;
  inComposer?: boolean;
}>) {
  const { file, status, error, locked } = attachment;
  const problem =
    attachment.uploaded && !attachment.processing && !attachment.uncertain
      ? fileProblems[status.data?.state ?? ""]
      : undefined;
  if (
    !file &&
    !error &&
    !status.error &&
    !attachment.processing &&
    !attachment.uncertain
  )
    return null;
  return (
    <View style={[styles.preview, inComposer && !!file && styles.inComposer]}>
      {file && (
        <>
          <ChatAttachmentTile
            file={file}
            locked={locked}
            onRemove={attachment.remove}
            status={
              attachment.processing
                ? "Đang gửi…"
                : attachment.pending
                  ? "Đang tải lên…"
                  : attachment.uncertain
                    ? "Chưa rõ kết quả gửi"
                    : attachment.ready
                      ? undefined
                      : (problem?.label ?? "Chờ kiểm tra tệp…")
            }
          />
          {problem && (
            <FormNotice tone="error" compact>
              {problem.message}
            </FormNotice>
          )}
          {!attachment.ready &&
            !problem &&
            !attachment.processing &&
            !attachment.pending &&
            !attachment.uncertain && (
              <Button
                variant="secondary"
                size="sm"
                disabled={locked || status.isFetching}
                onPress={() => {
                  if (attachment.uploaded) void status.refetch();
                  else void attachment.retryUpload();
                }}
              >
                Kiểm tra / thử lại
              </Button>
            )}
        </>
      )}
      <ConnectionFeedback error={error ?? status.error} />
      {attachment.uncertain && (
        <FormNotice tone="info" compact>
          Chưa rõ kết quả gửi. Giữ nguyên tệp để kiểm tra lại lần gửi trước.
        </FormNotice>
      )}
      {(attachment.processing || attachment.uncertain) && (
        <Button
          variant="secondary"
          disabled={attachment.pending}
          onPress={() => {
            void attachment.retry().then((text) => {
              if (text !== undefined) onRecovered(text);
            });
          }}
        >
          {attachment.publicationFailed
            ? "Thử gửi lại cùng tệp"
            : "Kiểm tra lại lần gửi tệp"}
        </Button>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  preview: { gap: 8 },
  inComposer: { paddingLeft: 50 },
});
