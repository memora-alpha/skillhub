import { useRef, useState } from "react";
import { FeaturePage, Panel } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { ConnectionFeedback } from "@/features/connections";
import { useConversation } from "../hooks/use-messages-api";
import { useChatAttachment } from "../hooks/use-chat-attachment";
import { ChatAttachmentPreview } from "../components/ChatAttachmentPreview";

// Preserve existing deep links; Chat itself now opens the device picker inline.
export function ApiAttachmentScreen({ id }: Readonly<{ id: string }>) {
  const conversation = useConversation(id);
  const attachment = useChatAttachment(id);
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
      title="Gửi tệp trong chat"
      demo={false}
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
        <Panel title="Đính kèm tệp">
          <Button
            variant="secondary"
            disabled={attachment.locked || !!conversation.error}
            onPress={() => {
              setSent(false);
              void attachment.choose();
            }}
          >
            Chọn tệp từ thiết bị
          </Button>
          <ChatAttachmentPreview
            attachment={attachment}
            onRecovered={recovered}
          />
          {attachment.file && (
            <>
              <Input
                label="Nội dung kèm tệp (tùy chọn)"
                value={text}
                onChangeText={updateText}
                maxLength={2000}
                editable={!attachment.locked}
              />
              <Button
                disabled={!attachment.ready || !!conversation.error}
                onPress={() => {
                  void attachment.send(text).then((accepted) => {
                    if (accepted) recovered(text);
                  });
                }}
              >
                Gửi tệp
              </Button>
            </>
          )}
          {sent && !attachment.processing && !attachment.uncertain && (
            <FormNotice tone="success">Tệp đã được gửi trong Chat.</FormNotice>
          )}
        </Panel>
      )}
    </FeaturePage>
  );
}
