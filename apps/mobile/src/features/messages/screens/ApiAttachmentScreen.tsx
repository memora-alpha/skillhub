import { useRef, useState } from "react";
import { getDocumentAsync } from "expo-document-picker";
import { useRouter } from "expo-router";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
} from "@/features/connections";
import { useConversation, useMessagesApi } from "../hooks/use-messages-api";
import { useMessageSend } from "../hooks/use-message-send";
import {
  chatFormats,
  validateChatFile,
  chatFileFormData,
  type ChatFile,
} from "../utils/chat-file";
function fileStateLabel(state?: string) {
  if (state === "READY") return "Sẵn sàng gửi";
  if (state === "SCANNING" || state === "QUARANTINED") return "Đang kiểm tra";
  return "Chưa sẵn sàng";
}

export function ApiAttachmentScreen({ id }: Readonly<{ id: string }>) {
  const runtime = useConnections(),
    api = useMessagesApi(),
    router = useRouter();
  const conversation = useConversation(id),
    sender = useMessageSend(id);
  const [file, setFile] = useState<ChatFile>(),
    [fileId, setFileId] = useState<string>();
  const [text, setText] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const status = useConnectionQuery(
    ["chat-file", id, fileId],
    () => api.fileStatus(id, fileId!),
    !!fileId && !!conversation.data,
  );
  const choose = async () => {
    if (busy.current || sender.processing) return;
    busy.current = true;
    try {
      const result = await getDocumentAsync({
        type: Object.values(chatFormats),
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !runtime.isCurrent()) return;
      const asset = result.assets[0];
      if (!asset) return;
      validateChatFile(asset);
      setFile(asset);
      setFileId(undefined);
      setError(undefined);
      setSubmitted(false);
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
    } finally {
      busy.current = false;
    }
  };
  const upload = async () => {
    if (!file || fileId || busy.current || !conversation.data) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await api.upload(id, chatFileFormData(file));
      runtime.assertCurrent();
      setFileId(result.fileId);
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
    } finally {
      if (runtime.isCurrent()) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const send = async () => {
    if (
      !fileId ||
      status.data?.state !== "READY" ||
      pending ||
      sender.pending ||
      sender.processing ||
      submitted
    )
      return;
    const confirmed = await status
      .refetch({ throwOnError: true })
      .catch((error_: unknown) => {
        setError(error_);
        return undefined;
      });
    if (confirmed?.data?.state !== "READY" || !runtime.isCurrent()) return;
    if (await sender.send(text, [fileId])) {
      setText("");
      setSubmitted(true);
      // Stay on the receipt view for 202; published history is the delivery source of truth.
    }
  };
  return (
    <FeaturePage
      title="Gửi tệp trong chat"
      demo={false}
      back={{
        pathname: "/chat/[proposalId]",
        params: { proposalId: id, mode: "api" },
      }}
    >
      <ConnectionFeedback
        loading={conversation.isLoading}
        error={conversation.error}
        retry={conversation.refetch}
      />
      {conversation.data && (
        <Panel title="Đính kèm tệp">
          <Copy muted>
            Tối đa 15 MB mỗi tệp. Tệp cần hoàn tất kiểm tra trước khi gửi.
          </Copy>
          <Button
            variant="secondary"
            disabled={pending || sender.pending || sender.processing}
            onPress={() => {
              void choose();
            }}
          >
            Chọn tệp
          </Button>
          {file && (
            <>
              <Copy>
                {file.name} ·{" "}
                {((file.file?.size ?? file.size ?? 0) / 1000000).toFixed(1)} MB
              </Copy>
              {!fileId && (
                <Button
                  disabled={pending}
                  onPress={() => {
                    void upload();
                  }}
                >
                  {pending ? "Đang tải lên..." : "Tải tệp lên để kiểm tra"}
                </Button>
              )}
              {fileId && (
                <>
                  <Copy>Trạng thái: {fileStateLabel(status.data?.state)}</Copy>
                  <ConnectionFeedback
                    loading={status.isLoading}
                    error={status.error}
                    retry={status.refetch}
                  />
                  <Button
                    variant="secondary"
                    disabled={status.isFetching}
                    onPress={() => {
                      void status.refetch();
                    }}
                  >
                    Kiểm tra trạng thái tệp
                  </Button>
                  <Input
                    label="Nội dung kèm tệp (tùy chọn)"
                    value={text}
                    onChangeText={setText}
                    maxLength={2000}
                    editable={!sender.pending && !sender.processing}
                  />
                  <Button
                    disabled={
                      submitted ||
                      status.data?.state !== "READY" ||
                      sender.pending ||
                      sender.processing
                    }
                    onPress={() => {
                      void send();
                    }}
                  >
                    {sender.pending ? "Đang gửi..." : "Gửi tệp"}
                  </Button>
                </>
              )}
            </>
          )}
          {!!error && error instanceof Error && !("kind" in error) ? (
            <FormNotice tone="error">{error.message}</FormNotice>
          ) : (
            <ConnectionFeedback error={error} />
          )}
          <ConnectionFeedback error={sender.error ?? sender.delivery.error} />
          {submitted && !sender.processing && (
            <FormNotice tone="success">Tệp đã được gửi trong Chat.</FormNotice>
          )}
          {sender.processing && (
            <>
              <Copy muted>Tệp đang được xử lý, chưa xác nhận đã gửi.</Copy>
              <Button
                variant="secondary"
                onPress={() => {
                  void sender.delivery.refetch();
                }}
              >
                Kiểm tra trạng thái gửi
              </Button>
              <Button
                variant="secondary"
                disabled={sender.pending}
                onPress={() => {
                  void sender.retryPublication();
                }}
              >
                Thử gửi lại cùng tệp
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            onPress={() =>
              router.dismissTo({
                pathname: "/chat/[proposalId]",
                params: { proposalId: id, mode: "api" },
              })
            }
          >
            Trở lại chat
          </Button>
        </Panel>
      )}
    </FeaturePage>
  );
}
