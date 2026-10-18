import { useState } from "react";
import { uuid } from "@/lib/http/contracts";
import { ApiAttachmentScreen } from "./ApiAttachmentScreen";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { SampleFiles, sampleFiles } from "@/components/sample-files";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { useMockMessages } from "../context/MockMessages";
export function AttachmentScreen() {
  const { proposalId } = useLocalSearchParams<{ proposalId: string }>();
  if (uuid.safeParse(proposalId).success)
    return <ApiAttachmentScreen id={proposalId} />;
  return <PreviewAttachmentScreen />;
}
function PreviewAttachmentScreen() {
  const { proposalId } = useLocalSearchParams<{ proposalId: string }>();
  const { conversations, sendFile } = useMockMessages();
  const router = useRouter();
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  return (
    <FeaturePage
      title="Gửi tệp trong chat"
      back={proposalId ? `/chat/${proposalId}` : "/messages"}
    >
      {!conversations.some((c) => c.proposal === proposalId) ? (
        <EmptyState
          title="Không tìm thấy cuộc trao đổi"
          description="Không thể gửi tệp vào cuộc trao đổi này."
        />
      ) : (
        <Panel title="Đính kèm tệp mẫu">
          <SampleFiles
            value={files}
            onChange={setFiles}
            maxCount={1}
            maxBytes={15 * 1024 * 1024}
          />
          <Copy muted>
            Giới hạn chat 15 MB/tệp. Tệp thật cần được kiểm tra định dạng và
            quét an toàn.
          </Copy>
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <Button
            onPress={() => {
              const file = sampleFiles.find((f) => f.name === files[0]);
              if (!file || !sendFile(proposalId, file)) {
                setError("Chọn tệp hợp lệ không vượt 15 MB.");
                return;
              }
              router.dismissTo(`/chat/${proposalId}`);
            }}
          >
            Gửi tệp mẫu
          </Button>
        </Panel>
      )}
    </FeaturePage>
  );
}
