import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useLearningPath } from "@/features/learning-paths";
import { useConnections } from "@/features/connections";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Copy, FeaturePage } from "@/components/feature-page";
import { uuid } from "@/lib/http/contracts";
import { ApiSessionCard } from "../components/ApiSessionCard";
import { SessionReadFeedback } from "../components/SessionReadFeedback";
import { useSessionsMonth } from "../hooks/use-sessions";
import { isSessionHistory } from "../utils/session-calendar";

export function PathSessionsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <PathSessionList id={id} /> : <SessionHistory />;
}

function SessionHistory() {
  const [date, setDate] = useState(() => new Date());
  const year = date.getFullYear(),
    month = date.getMonth();
  const query = useSessionsMonth(year, month);
  const items =
    query.data?.filter((s) => isSessionHistory(s, Date.now())) ?? [];
  return (
    <FeaturePage
      title="Lịch sử học tập"
      section="Lịch học"
      demo={false}
      back="/calendar"
      refreshing={query.isFetching && !query.isLoading}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <Copy>
        Tháng {month + 1}, {year}
      </Copy>
      <Button
        variant="paper"
        onPress={() => setDate(new Date(year, month - 1, 1))}
      >
        Tháng trước
      </Button>
      <Button
        variant="paper"
        onPress={() => setDate(new Date(year, month + 1, 1))}
      >
        Tháng sau
      </Button>
      <SessionReadFeedback query={query} />
      {items.map((session) => (
        <ApiSessionCard key={session.id} session={session} />
      ))}
      {query.data?.length === 100 && (
        <Copy muted>
          Đang hiển thị tối đa 100 buổi trong tháng. Danh sách có thể chưa đầy
          đủ.
        </Copy>
      )}
      {query.data && !query.error && !items.length && (
        <EmptyState
          title="Chưa có lịch sử trong tháng này"
          description="Chọn tháng khác để xem các buổi đã kết thúc."
        />
      )}
    </FeaturePage>
  );
}

function PathSessionList({ id }: Readonly<{ id: string }>) {
  const query = useLearningPath(id);
  const runtime = useConnections();
  const items =
    query.data?.plans
      .flatMap((plan) =>
        plan.sessions.map((session) => ({
          ...session,
          teacherId: plan.teacherId,
          learnerId: plan.learnerId,
          role:
            plan.teacherId === runtime.userId
              ? ("TEACHER" as const)
              : ("LEARNER" as const),
          title: `Buổi ${session.sessionNo} · ${plan.sessionOutline.find((s) => s.sessionNo === session.sessionNo)?.content.split("\n")[0] ?? plan.learningGoal}`,
        })),
      )
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)) ?? [];
  return (
    <FeaturePage
      title="Buổi học của Learning Path"
      section="Lịch học"
      demo={false}
      back={uuid.safeParse(id).success ? `/paths/${id}` : "/calendar"}
      refreshing={query.isFetching && !query.isLoading}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <SessionReadFeedback query={query} />
      {!uuid.safeParse(id).success && (
        <EmptyState
          title="Không tìm thấy Learning Path"
          description="Mở danh sách buổi học từ một lộ trình hợp lệ."
        />
      )}
      {items.map((session) => (
        <ApiSessionCard
          key={session.id}
          session={session}
          title={session.title}
        />
      ))}
      {query.data && !query.error && !items.length && (
        <EmptyState
          title="Chưa có buổi học"
          description="Buổi học xuất hiện sau khi lịch được chốt và Learning Path được khóa."
        />
      )}
    </FeaturePage>
  );
}
