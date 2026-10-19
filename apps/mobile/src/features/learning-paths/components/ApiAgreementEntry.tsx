import { PathReadFeedback } from "./PathReadFeedback";
import { useRouter } from "expo-router";
import { Copy, Panel } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import { ApiAgreementForm } from "./ApiAgreementForm";
import { ApiPathCard } from "./ApiPathsContent";
import {
  useLearningPaths,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import { createPathOnce } from "../api/creation-attempt";

export function ApiAgreementEntry({
  conversationId,
  participantAId,
  participantBId,
}: Readonly<{
  conversationId: string;
  participantAId: string;
  participantBId: string;
}>) {
  const query = useLearningPaths(),
    api = useLearningPathsApi(),
    runtime = useConnections();
  const command = useConnectionCommand(),
    router = useRouter();
  const paths = query.data?.filter((p) => p.conversationId === conversationId);
  return (
    <>
      <PathReadFeedback query={query} />
      {paths?.map((path) => (
        <ApiPathCard key={path.id} path={path} />
      ))}
      {paths?.length === 0 && !query.error && (
        <Panel title="Thống nhất lộ trình chính thức">
          {query.data!.length < 100 ? (
            <>
              <ApiAgreementForm
                userId={runtime.userId ?? ""}
                otherId={
                  participantAId === runtime.userId
                    ? participantBId
                    : participantAId
                }
                conversationId={conversationId}
                pending={command.pending || query.isFetching}
                onSubmit={async (input) => {
                  const result = await command.run(JSON.stringify(input), () =>
                    createPathOnce(`${runtime.userId}:${conversationId}`, () =>
                      api.create(input),
                    ),
                  );
                  if (result) router.push(`/paths/${result.id}`);
                  else void query.refetch();
                }}
              />
              <ConnectionFeedback error={command.error} retry={query.refetch} />
            </>
          ) : (
            <Copy>
              Danh sách đã đạt giới hạn tải. Chưa thể xác định cuộc trao đổi này
              có lộ trình hay chưa; không tạo thêm để tránh trùng.
            </Copy>
          )}
        </Panel>
      )}
    </>
  );
}
