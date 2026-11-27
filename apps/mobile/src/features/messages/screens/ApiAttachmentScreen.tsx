import { useRef, useState } from "react";
import { FeaturePage, Panel } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { ConnectionFeedback } from "@/features/connections";
import { useConversation } from "../hooks/use-messages-api";
import { useChatAttachment } from "../hooks/use-chat-attachment";
import { ChatAttachmentPreview } from "../components/ChatAttachmentPreview";
import { chatAttachmentNoun } from "../utils/chat-attachment-kind";

// Preserve existing deep links; Chat itself now opens the device picker inline.
export function ApiAttachmentScreen({ id }: Readonly<{ id: string }>) {
  const conversation = useConversation(id);
  const attachment = useChatAttachment(id);
  const noun = chatAttachmentNoun(attachment.file?.mimeType);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const draft = useRef("");
  const updateText = (value: string) => {
    draft.current = value;
    setText(value);
  };
  const recovered = (original: string) => {
    if (draft.current === original) updateText("");
    setSent(true);
  };
  return (
    <FeaturePage
      title="Gửi ảnh hoặc tệp trong chat"
      backBehavior="history"
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
        <Panel title="Đính kèm ảnh hoặc tệp">
          <Button
            variant="secondary"
            disabled={attachment.locked || !!conversation.error}
            onPress={() => {
              setSent(false);
              void attachment.choose("photos");
            }}
          >
            Chọn ảnh
          </Button>
          <Button
            variant="secondary"
            disabled={attachment.locked || !!conversation.error}
            onPress={() => {
              setSent(false);
              void attachment.choose("files");
            }}
          >
            Chọn tệp từ thiết bị
          </Button>
          <ChatAttachmentPreview attachment={attachment} />
          {attachment.file && (
            <>
              <Input
                label={`Nội dung kèm ${noun} (tùy chọn)`}
                value={text}
                onChangeText={updateText}
                maxLength={2000}
                editable={!attachment.locked}
              />
              <Button
                disabled={!attachment.ready || !!conversation.error}
                onPress={() => {
                  if (attachment.send(text)) recovered(text);
                }}
              >
                {`Gửi ${noun}`}
              </Button>
            </>
          )}
          {sent && (
            <FormNotice tone="info">
              Đã thêm vào Chat. Nội dung đang được gửi.
            </FormNotice>
          )}
        </Panel>
      )}
    </FeaturePage>
  );
}
