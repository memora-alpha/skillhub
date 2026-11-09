import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { useLearningPath } from "@/features/learning-paths/state";
import { useConnections } from "@/features/connections";
import {
  SessionPage,
  SessionEmptyState,
  SessionCopy,
} from "../components/session-page";
import { deviceTimezone } from "../utils/session-time";
import { pathSessionItems } from "../utils/session-context";
import { SessionCard } from "../components/session-card";
import { SessionFeedback } from "../components/session-feedback";

export function PathSessionsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const valid = z.uuid().safeParse(id).success;
  const query = useLearningPath(id ?? ""),
    runtime = useConnections();
  const items = query.data ? pathSessionItems(query.data) : [];
  return (
    <SessionPage
      title="Tất cả buổi học"
      back={valid ? `/paths/${id}` : "/my-learning"}
      backBehavior="history"
    >
      <SessionFeedback
        {...query}
        enabled={runtime.enabled && valid}
        denial={query.denied ? "unavailable" : undefined}
        invalid={!valid}
        refreshing={query.isFetching}
        retry={() => query.refetch()}
      >
        {items.length > 0 && (
          <SessionCopy muted>
            {items.length} buổi học trong lộ trình
          </SessionCopy>
        )}
        {items.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            timezone={deviceTimezone()}
          />
        ))}
        {!items.length && (
          <SessionEmptyState
            title="Lộ trình chưa có buổi học"
            description="Buổi học sẽ xuất hiện sau khi hai bên chốt lịch học."
          />
        )}
      </SessionFeedback>
    </SessionPage>
  );
}
