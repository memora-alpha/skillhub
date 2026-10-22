import { useLocalSearchParams } from "expo-router";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import {
  Copy,
  FeaturePage,
  Panel,
  RouteButton,
} from "@/components/feature-page";
import { useSession, useSessionCompletion } from "../hooks/use-sessions";
import {
  canConfirmSession,
  sessionConfirmations,
} from "../utils/session-calendar";
import { ApiSessionCard } from "../components/ApiSessionCard";
import { SessionReadFeedback } from "../components/SessionReadFeedback";
import type { ApiSessionDetail } from "../api/sessions-api";

function SessionProgress({ session }: Readonly<{ session: ApiSessionDetail }>) {
  return (
    <Panel title="Tiến độ học tập">
      <Copy>
        Kế hoạch này: {session.progress.plan.completed}/
        {session.progress.plan.total} buổi hoàn thành
      </Copy>
      <Copy>
        Toàn Learning Path: {session.progress.agreement.completed}/
        {session.progress.agreement.total} buổi hoàn thành
      </Copy>
    </Panel>
  );
}

function CompletionStatus({
  session,
}: Readonly<{ session: ApiSessionDetail }>) {
  const confirmed = sessionConfirmations(session);
  return (
    <>
      <Copy>
        Bạn: {confirmed.mine ? "Đã xác nhận" : "Chưa xác nhận"} · Người trao
        đổi: {confirmed.partner ? "Đã xác nhận" : "Chưa xác nhận"}
      </Copy>
      {session.teacherConfirmedAt && (
        <Copy muted>
          Người dạy xác nhận:{" "}
          {new Date(session.teacherConfirmedAt).toLocaleString("vi-VN")}
        </Copy>
      )}
      {session.learnerConfirmedAt && (
        <Copy muted>
          Người học xác nhận:{" "}
          {new Date(session.learnerConfirmedAt).toLocaleString("vi-VN")}
        </Copy>
      )}
      <Copy muted>
        Buổi học hoàn thành khi cả hai người xác nhận sau giờ kết thúc. Credit
        được xử lý ở cuối Learning Path.
      </Copy>
    </>
  );
}

export function LearningSessionScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const query = useSession(id);
  const session = query.data;
  return (
    <FeaturePage
      title="Chi tiết buổi học"
      section="Lịch học"
      demo={false}
      back={session ? `/paths/${session.pathId}/sessions` : "/calendar"}
      refreshing={query.isFetching && !query.isLoading}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <SessionReadFeedback query={query} />
      {!uuid.safeParse(id).success && (
        <EmptyState
          title="Không tìm thấy buổi học"
          description="Mở buổi học từ lịch hoặc Learning Path hợp lệ."
        />
      )}
      {session && (
        <>
          <ApiSessionCard
            session={session}
            title={`Buổi ${session.outlineSessionNo}`}
          >
            <CompletionStatus session={session} />
          </ApiSessionCard>
          <SessionProgress session={session} />
          <RouteButton href={`/learning-sessions/${id}/completion`}>
            Xác nhận & kết quả buổi học
          </RouteButton>
          <RouteButton secondary href={`/paths/${session.pathId}/schedules`}>
            Xem lịch của Learning Path
          </RouteButton>
          <RouteButton secondary href={`/paths/${session.pathId}`}>
            Xem Learning Path
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}

export function CompletionScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  return <CompletionContent key={`${runtime.key.join(":")}:${id}`} id={id} />;
}

function CompletionContent({ id }: Readonly<{ id: string }>) {
  const query = useSession(id);
  const command = useSessionCompletion(id);
  const session = query.data;
  return (
    <FeaturePage
      title="Xác nhận đã học"
      section="Lịch học"
      demo={false}
      back={
        uuid.safeParse(id).success ? `/learning-sessions/${id}` : "/calendar"
      }
      refreshing={query.isFetching && !query.isLoading}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <SessionReadFeedback query={query} />
      {!uuid.safeParse(id).success && (
        <EmptyState
          title="Không tìm thấy buổi học"
          description="Không thể xác nhận buổi học này."
        />
      )}
      <ConnectionFeedback error={command.error} />
      {command.error && (
        <FormNotice tone="info">
          Hãy tải lại để kiểm tra xác nhận đã được ghi nhận chưa. Nếu chưa, bạn
          có thể bấm xác nhận lại.
        </FormNotice>
      )}
      {session && (
        <>
          <Panel
            title={
              session.status === "COMPLETED"
                ? "Buổi học đã hoàn thành"
                : "Cùng xác nhận sau buổi học"
            }
          >
            <CompletionStatus session={session} />
            <Button
              disabled={
                command.isPending ||
                query.isFetching ||
                !!query.error ||
                !canConfirmSession(session, Date.now())
              }
              onPress={() => {
                if (
                  !command.isPending &&
                  !query.isFetching &&
                  !query.error &&
                  canConfirmSession(session, Date.now())
                )
                  command.mutate();
              }}
            >
              {command.isPending
                ? "Đang gửi xác nhận…"
                : "Tôi xác nhận đã học buổi này"}
            </Button>
          </Panel>
          <SessionProgress session={session} />
          <RouteButton secondary href={`/paths/${session.pathId}`}>
            Xem Learning Path
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
