import { useState } from "react";
import { Copy } from "@/components/feature-page";
import { FlowSection as Panel } from "@/components/learning-flow";
import { Button } from "@/components/Button";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useParticipantName,
} from "@/features/connections";
import { ApiAgreementForm } from "./ApiAgreementForm";
import {
  agreementConfirmed,
  editablePath,
  ownConfirmation,
} from "../utils/policy-api";
import { useLearningPathsApi } from "../hooks/use-learning-paths-api";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { agreementSubmission } from "../api/agreement-submission";
import { useConfirmedFormShare } from "@/features/messages/state";
import { confirmedMethodMessage } from "../utils/confirmed-form";
import { confirmAndShare } from "../api/confirm-and-share";
import { AgreementMethodSummary } from "./agreement-method-summary";
import {
  AgreementFooter,
  agreementFooterPrimaryStyle,
} from "./agreement-footer";

export function AgreementMethodStep({
  path,
  blocked,
  initiallyEditing = false,
  onContinue,
  onRefresh,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  initiallyEditing?: boolean;
  onContinue: () => void;
  onRefresh: () => unknown;
}>) {
  const runtime = useConnections(),
    api = useLearningPathsApi(),
    command = useConnectionCommand();
  const [editing, setEditing] = useState(initiallyEditing);
  const share = useConfirmedFormShare();
  const otherId =
    path.participantAId === runtime.userId
      ? path.participantBId
      : path.participantAId;
  const name = useParticipantName(otherId);
  const mine = !!ownConfirmation(path, path.agreement, runtime.userId);
  const other =
    path.participantAId === otherId
      ? path.agreement.participantAConfirmedAt
      : path.agreement.participantBConfirmedAt;
  const both = agreementConfirmed(path),
    editable = editablePath(path);
  const pending = blocked || command.pending || command.uncertain;
  return (
    <>
      <Panel title={editing ? "Điều chỉnh cách học" : undefined}>
        {editing && editable ? (
          <ApiAgreementForm
            key={path.currentVersion}
            path={path}
            userId={runtime.userId ?? ""}
            otherId={otherId}
            conversationId={path.conversationId}
            pending={pending}
            onSubmit={async (input) => {
              if (pending || !runtime.isCurrent()) return;
              const submission = agreementSubmission(
                () => api.revise(path.id, input, path.currentVersion),
                api.confirm,
                runtime.isCurrent,
                (saved, identity) => {
                  void share.publish(
                    path.conversationId,
                    confirmedMethodMessage(saved.id, saved.version, input),
                    identity,
                  );
                },
                (saved) => !saved.unchanged || !mine,
              );
              const result = await command.run(
                JSON.stringify({
                  id: path.id,
                  version: path.currentVersion,
                  input,
                }),
                submission.send,
              );
              if (runtime.isCurrent() && (result || submission.saved)) {
                setEditing(false);
                void onRefresh();
              }
            }}
          />
        ) : (
          <AgreementMethodSummary
            path={path}
            userId={runtime.userId}
            otherId={otherId}
            otherName={name.data ?? "Đối tác"}
            mine={mine}
            other={!!other}
          >
            {path.currentVersion > 1 && !both && !mine && (
              <Copy muted>
                Thỏa thuận đã thay đổi. Bạn cần xem lại trước khi đồng ý.
              </Copy>
            )}
          </AgreementMethodSummary>
        )}
        {editable && editing && (
          <Button
            variant="secondary"
            disabled={pending}
            onPress={() => setEditing(!editing)}
          >
            Hủy điều chỉnh
          </Button>
        )}
        {!!command.error && <ConnectionFeedback error={command.error} />}
        {command.uncertain && (
          <>
            <Copy muted>
              Chưa rõ kết quả lần gửi. Kiểm tra trạng thái trước khi gửi tiếp.
            </Copy>
            {!mine && (
              <Button
                variant="secondary"
                disabled={blocked || command.pending}
                onPress={() => {
                  void onRefresh();
                }}
              >
                Kiểm tra trạng thái
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={blocked || command.pending}
              onPress={() => {
                void command.retry();
              }}
            >
              Thử lại lần gửi trước
            </Button>
          </>
        )}
      </Panel>
      {!editing && (
        <AgreementFooter
          conversationId={path.conversationId}
          review={
            editable
              ? {
                  label: "Chỉnh sửa cách học",
                  onPress: () => setEditing(true),
                  disabled: pending,
                }
              : undefined
          }
        >
          {editable && !mine && (
            <Button
              variant="craft"
              style={agreementFooterPrimaryStyle}
              disabled={pending}
              onPress={() => {
                if (pending || !runtime.isCurrent()) return;
                void command.run(
                  `agreement:${path.id}:${path.currentVersion}`,
                  confirmAndShare(
                    () => api.confirm(path.id, path.currentVersion),
                    (result, identity) => {
                      void share.publish(
                        path.conversationId,
                        confirmedMethodMessage(
                          path.id,
                          result.currentVersion,
                          path.agreement,
                        ),
                        identity,
                      );
                    },
                    runtime.isCurrent,
                  ),
                );
              }}
            >
              {command.pending ? "Đang xác nhận…" : "Đồng ý cách học"}
            </Button>
          )}
          {editable && mine && !both && (
            <Copy>Đã xác nhận · Chờ đối tác đồng ý cách học.</Copy>
          )}
          {both && (
            <Button
              style={agreementFooterPrimaryStyle}
              disabled={pending}
              onPress={onContinue}
            >
              Tiếp tục: Lộ trình
            </Button>
          )}
        </AgreementFooter>
      )}
    </>
  );
}
