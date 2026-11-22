import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AutomaticFileStatus } from "@/components/automatic-file-status";
import { ConnectionFeedback } from "@/features/connections";
import { AppError, errorMessage } from "@/lib/http/errors";
import { filePickerError } from "@/lib/http/file-picker-error";
import { FileSelectionError } from "@/lib/http/picked-image";
import { isContentRejection } from "../utils/chat-send-notice";
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

function attachmentStatus(
  attachment: ReturnType<typeof useChatAttachment>,
  problemLabel?: string,
  temporaryModeration = false,
  failedCheck = false,
) {
  if (attachment.processing) return "Đang gửi…";
  if (attachment.pending) return "Đang tải lên…";
  if (temporaryModeration) return "Đang gửi…";
  if (attachment.uncertain) return "Chưa rõ kết quả gửi";
  if (problemLabel) return problemLabel;
  if (attachment.ready) return undefined;
  if (failedCheck) return "Chưa kiểm tra được tệp";
  if (attachment.error && !attachment.uploaded) return "Chưa tải được tệp lên";
  return "Đang xử lý…";
}

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
  const [checkFailure, setCheckFailure] = useState<{
    fileId: string;
    message: string | undefined;
  }>();
  const checkFailed =
    !!status.error ||
    (!!checkFailure?.message && checkFailure.fileId === status.data?.fileId);
  const failure = error ?? status.error;
  const temporaryModeration =
    failure instanceof AppError &&
    failure.code === "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE";
  const contentRejected =
    failure instanceof AppError && isContentRejection(failure.code);
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
            status={attachmentStatus(
              attachment,
              problem?.label,
              temporaryModeration,
              checkFailed,
            )}
          />
          {problem && (
            <FormNotice tone="error" compact>
              {problem.message}
            </FormNotice>
          )}
          {attachment.uploaded && status.data && (
            <AutomaticFileStatus
              files={[
                {
                  fileId: status.data.fileId,
                  state: status.data.state,
                  name: file.name,
                },
              ]}
              onChange={attachment.updateFileStatus}
              status={attachment.readFileStatus}
              isCurrent={attachment.isCurrent}
              enabled={!locked && !status.error}
              onError={(message) =>
                setCheckFailure({ fileId: status.data!.fileId, message })
              }
            />
          )}
          {!attachment.ready &&
            !!failure &&
            !contentRejected &&
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
                Thử lại
              </Button>
            )}
        </>
      )}
      {contentRejected ? (
        <FormNotice tone="error" compact>
          {errorMessage(failure)}
        </FormNotice>
      ) : failure &&
        (failure instanceof FileSelectionError ||
          !attachment.uploaded ||
          failure === status.error) ? (
        <FormNotice tone="error" compact>
          {filePickerError(failure, attachment.uploaded ? "status" : "upload")}
        </FormNotice>
      ) : (
        !temporaryModeration && <ConnectionFeedback error={failure} />
      )}
      {attachment.uncertain && !temporaryModeration && (
        <FormNotice tone="info" compact>
          Chưa rõ kết quả gửi. Giữ nguyên tệp để kiểm tra lại lần gửi trước.
        </FormNotice>
      )}
      {(attachment.uncertain ||
        attachment.publicationFailed ||
        (attachment.processing && !!failure)) && (
        <Button
          variant="secondary"
          disabled={attachment.pending}
          onPress={() => {
            void attachment.retry().then((text) => {
              if (text !== undefined) onRecovered(text);
            });
          }}
        >
          {temporaryModeration || attachment.publicationFailed
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
