import { FormNotice } from "@/components/FormNotice";
import { useSessionContext } from "../hooks/use-session-context";
import type { LearningSession } from "../types";
import {
  SessionPanel,
  SessionCopy,
  SessionButton,
  SessionRouteButton,
} from "./session-page";

export function SessionContextPanel({
  session,
}: Readonly<{ session: LearningSession }>) {
  const query = useSessionContext(session),
    context = query.context;
  return (
    <>
      {session.progress && (
        <SessionPanel title="Tiến độ học tập">
          <SessionCopy>
            Lộ trình kỹ năng: {session.progress.plan.completed}/
            {session.progress.plan.total} buổi hoàn thành
          </SessionCopy>
          <SessionCopy muted>
            Toàn thỏa thuận: {session.progress.agreement.completed}/
            {session.progress.agreement.total} buổi hoàn thành
          </SessionCopy>
        </SessionPanel>
      )}
      <SessionPanel title="Nội dung buổi học">
        {context ? (
          <>
            <SessionCopy muted>
              Buổi {context.outline.sessionNo} · Lộ trình bản{" "}
              {context.plan.version}
            </SessionCopy>
            <SessionCopy>{context.outline.content}</SessionCopy>
            <SessionRouteButton
              secondary
              href={`/paths/${context.path.id}/plans/${context.plan.id}`}
            >
              Xem lộ trình
            </SessionRouteButton>
          </>
        ) : (
          <SessionCopy muted>
            {query.isLoading
              ? "Đang tải nội dung buổi học…"
              : "Chưa đọc được nội dung lộ trình phù hợp với buổi học này."}
          </SessionCopy>
        )}
        {!!query.error && (
          <FormNotice tone="error">
            Chưa cập nhật được nội dung lộ trình. Thông tin buổi học vẫn hiển
            thị theo dữ liệu Session.
          </FormNotice>
        )}
        {(!context || !!query.error) && !query.isLoading && (
          <SessionButton
            variant="paper"
            disabled={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            Tải lại nội dung
          </SessionButton>
        )}
      </SessionPanel>
    </>
  );
}
