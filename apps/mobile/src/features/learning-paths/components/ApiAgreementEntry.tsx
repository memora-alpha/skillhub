import { PathReadFeedback } from "./PathReadFeedback";
import { useRef } from "react";
import { Redirect, useRouter } from "expo-router";
import { Copy, RouteButton } from "@/components/feature-page";
import { FlowSection as Panel } from "@/components/learning-flow";
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
import { AgreementSteps } from "./agreement-steps";
import { agreementSubmission } from "../api/agreement-submission";
import { useConfirmedFormShare } from "@/features/messages/state";
import { confirmedMethodMessage } from "../utils/confirmed-form";

export function ApiAgreementEntry({
  conversationId,
  participantAId,
  participantBId,
  blocked = false,
}: Readonly<{
  conversationId: string;
  participantAId: string;
  participantBId: string;
  blocked?: boolean;
}>) {
  const query = useLearningPaths(),
    api = useLearningPathsApi(),
    runtime = useConnections();
  const command = useConnectionCommand([["learning-paths", "mine"]]),
    router = useRouter();
  const paths = query.data?.filter((p) => p.conversationId === conversationId);
  const creating = useRef(false);
  const share = useConfirmedFormShare();
  const existingId = paths?.length === 1 ? paths[0]?.id : undefined;
  if (existingId && !creating.current)
    return (
      <>
        <PathReadFeedback query={query} />
        {!blocked &&
        !query.error &&
        !query.isFetching &&
        runtime.isCurrent() ? (
          <Redirect
            href={{
              pathname: "/paths/[id]",
              params: { id: existingId, fromConversation: conversationId },
            }}
          />
        ) : (
          !query.error && (
            <Copy muted size="hint">
              Đang mở thỏa thuận…
            </Copy>
          )
        )}
      </>
    );
  return (
    <>
      <PathReadFeedback query={query} />
      {paths?.map((path) => (
        <ApiPathCard key={path.id} path={path} />
      ))}
      {paths?.length === 0 && (
        <>
          <AgreementSteps value="method" current="method" onSelect={() => {}} />
          <Panel title="Đề xuất cách học">
            {query.data!.length < 100 ? (
              <>
                <Copy size="hint">
                  Chọn hình thức, vai trò và Credit. Cả hai đồng ý trước khi tạo
                  lộ trình.
                </Copy>
                <ApiAgreementForm
                  userId={runtime.userId ?? ""}
                  otherId={
                    participantAId === runtime.userId
                      ? participantBId
                      : participantAId
                  }
                  conversationId={conversationId}
                  pending={
                    blocked ||
                    !!query.error ||
                    command.pending ||
                    command.uncertain ||
                    query.isFetching
                  }
                  onSubmit={async (input) => {
                    if (
                      blocked ||
                      query.error ||
                      query.isFetching ||
                      command.uncertain ||
                      !runtime.isCurrent()
                    )
                      return;
                    creating.current = true;
                    const submission = agreementSubmission(
                      () =>
                        createPathOnce(
                          `${runtime.userId}:${conversationId}`,
                          () => api.create(input),
                        ),
                      api.confirm,
                      runtime.isCurrent,
                      (saved, identity) => {
                        void share.publish(
                          conversationId,
                          confirmedMethodMessage(
                            saved.id,
                            saved.version,
                            input,
                          ),
                          identity,
                        );
                      },
                    );
                    const result = await command.run(
                      JSON.stringify(input),
                      submission.send,
                    );
                    if (result) router.replace(`/paths/${result.id}`);
                    else if (submission.saved && runtime.isCurrent())
                      router.replace(`/paths/${submission.saved.id}`);
                    else void query.refetch();
                  }}
                />
                <ConnectionFeedback
                  error={command.error}
                  retry={query.refetch}
                />
                {command.uncertain && (
                  <>
                    <Copy>
                      Chưa xác định được lần tạo trước. Tải lại trạng thái hoặc
                      mở danh sách lộ trình để đối chiếu; không gửi lại tự động.
                    </Copy>
                    <RouteButton href="/my-learning?tab=paths">
                      Xem các lộ trình
                    </RouteButton>
                  </>
                )}
              </>
            ) : (
              <Copy>
                Danh sách đã đạt giới hạn tải. Chưa thể xác định cuộc trao đổi
                này có lộ trình hay chưa; không tạo thêm để tránh trùng.
              </Copy>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
