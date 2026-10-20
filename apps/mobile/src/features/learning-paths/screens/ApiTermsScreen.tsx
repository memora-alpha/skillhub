import { PathReadFeedback } from "../components/PathReadFeedback";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage, Panel } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import { editablePath } from "../policy-api";
import { ApiAgreementForm } from "../components/ApiAgreementForm";

export function ApiTermsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id),
    api = useLearningPathsApi(),
    runtime = useConnections();
  const command = useConnectionCommand(),
    router = useRouter(),
    path = query.data;
  return (
    <FeaturePage
      title="Thay đổi hình thức và Credit"
      demo={false}
      back={`/paths/${id}`}
    >
      <PathReadFeedback query={query} />
      {path && editablePath(path) && !query.error && (
        <Panel title="Nội dung mới để hai bạn xem lại">
          <ApiAgreementForm
            key={path.currentVersion}
            path={path}
            conversationId={path.conversationId}
            userId={runtime.userId ?? ""}
            otherId={
              path.participantAId === runtime.userId
                ? path.participantBId
                : path.participantAId
            }
            pending={command.pending || query.isFetching}
            onSubmit={async (input) => {
              const result = await command.run(
                JSON.stringify({ id, input, version: path.currentVersion }),
                () => api.revise(id, input, path.currentVersion),
              );
              if (result) router.replace(`/paths/${id}`);
            }}
          />
          <ConnectionFeedback error={command.error} />
        </Panel>
      )}
      {path && !editablePath(path) && (
        <EmptyState
          title="Điều khoản đã khóa"
          description="Không thể thay đổi điều khoản qua luồng thương lượng."
        />
      )}
    </FeaturePage>
  );
}
