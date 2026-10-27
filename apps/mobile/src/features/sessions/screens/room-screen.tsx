import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FormNotice } from "@/components/FormNotice";
import { useSessionDetail } from "../hooks/use-sessions";
import { useSessionPartner } from "../hooks/use-session-partner";
import { useSessionClock } from "../hooks/use-session-clock";
import { useSessionsRuntime } from "../runtime";
import { SessionFeedback } from "../components/session-feedback";
import {
  SessionPage,
  SessionPanel,
  SessionCopy,
  SessionButton,
} from "../components/session-page";
import { RoomMedia, roomMediaAvailable } from "../components/room-media";
import {
  canJoinSession,
  joinReason,
  sessionJoinReason,
} from "../utils/session-join";
import { sessionErrorMessage } from "../utils/session-read";

export function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useSessionsRuntime();
  return <SessionRoom key={`${runtime.key.join(":")}:${id}`} id={id} />;
}

function SessionRoom({ id }: Readonly<{ id: string }>) {
  const [attempt, setAttempt] = useState(0);
  const query = useSessionDetail(id, attempt > 0);
  const partner = useSessionPartner(query.data);
  const runtime = useSessionsRuntime();
  const session = query.data;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const now = useSessionClock(session, () => {
    if (
      runtime.isCurrent() &&
      focused.current &&
      AppState.currentState === "active"
    )
      void query.refetch({ cancelRefetch: false });
  });
  const focused = useRef(false);
  const retryLock = useRef(false);
  const intent = useRef(0);
  const callIsCurrent = useCallback(
    () =>
      runtime.isCurrent() &&
      focused.current &&
      AppState.currentState !== "background" &&
      !!sessionRef.current &&
      ["CONFIRMED", "READY", "ONGOING"].includes(sessionRef.current.status) &&
      Date.now() < Date.parse(sessionRef.current.endAt),
    [runtime.isCurrent],
  );
  const [notice, setNotice] = useState("");
  const terminal =
    !!session && !["CONFIRMED", "READY", "ONGOING"].includes(session.status);
  const ended = !!session && now >= Date.parse(session.endAt);
  useEffect(() => {
    if (!session || terminal || ended || !runtime.enabled) {
      intent.current++;
      setAttempt(0);
    }
  }, [session, terminal, ended, runtime.enabled]);
  const leave = useCallback(() => {
    intent.current++;
    setAttempt(0);
    setNotice(
      "Bạn đã rời phòng học. Rời phòng không xác nhận hoàn thành buổi học.",
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "background") {
          intent.current++;
          setAttempt(0);
          setNotice(
            "Cuộc gọi đã dừng khi ứng dụng chuyển sang nền. Bạn có thể vào lại phòng.",
          );
        }
      });
      return () => {
        intent.current++;
        focused.current = false;
        subscription.remove();
        setAttempt(0);
      };
    }, []),
  );
  const join = () => {
    if (
      !callIsCurrent() ||
      query.isFetching ||
      query.error ||
      !canJoinSession(session)
    )
      return;
    setNotice("");
    intent.current++;
    setAttempt((value) => value + 1);
  };
  const retry = async () => {
    if (retryLock.current || !callIsCurrent()) return;
    retryLock.current = true;
    const ticket = ++intent.current;
    try {
      const result = await query.refetch({ cancelRefetch: false });
      if (!callIsCurrent() || ticket !== intent.current) return;
      if (result.error || !canJoinSession(result.data)) {
        setAttempt(0);
        setNotice(
          result.error
            ? sessionErrorMessage(result.error)
            : joinReason(sessionJoinReason(result.data)),
        );
        return;
      }
      setNotice("");
      setAttempt((value) => value + 1);
    } catch (cause) {
      if (callIsCurrent() && ticket === intent.current) {
        setAttempt(0);
        setNotice(sessionErrorMessage(cause));
      }
    } finally {
      retryLock.current = false;
    }
  };
  return (
    <SessionPage
      title="Phòng học"
      back={`/learning-sessions/${id}`}
      backBehavior="history"
    >
      <SessionFeedback
        {...query}
        invalid={!query.valid}
        refreshing={query.isFetching}
        retry={() => query.refetch()}
      >
        {session && (
          <>
            <SessionPanel title="Buổi học trực tuyến">
              <SessionCopy>
                {partner.data?.fullName ?? "Người trao đổi"}
              </SessionCopy>
              <SessionCopy muted>
                Bạn có thể vào sớm tối đa 15 phút và vào lại khi mất kết nối
                trong giờ học. Camera và micro chỉ bật khi bạn vào phòng. Cả hai
                người vẫn cần xác nhận hoàn thành sau buổi học.
              </SessionCopy>
            </SessionPanel>
            {(ended || !!notice) && (
              <FormNotice tone="info">
                {ended ? joinReason("SESSION_ENDED") : notice}
              </FormNotice>
            )}
            {!roomMediaAvailable && (
              <FormNotice tone="info">
                Hãy dùng bản cài đặt SkillHub Android/iOS có hỗ trợ gọi video để
                vào phòng.
              </FormNotice>
            )}
            {attempt > 0 && !terminal && !ended && runtime.enabled ? (
              <RoomMedia
                key={attempt}
                sessionId={id}
                api={runtime.api}
                isCurrent={callIsCurrent}
                partnerName={partner.data?.fullName ?? "Người trao đổi"}
                onLeave={leave}
                onRetry={() => {
                  void retry();
                }}
                retrying={query.isFetching}
              />
            ) : (
              <SessionPanel title="Chuẩn bị vào học">
                <SessionCopy>
                  {canJoinSession(session, now)
                    ? "Phòng học đã mở. Kiểm tra kết nối và cho phép camera, micro khi được hỏi."
                    : joinReason(sessionJoinReason(session, now))}
                </SessionCopy>
                <SessionButton
                  disabled={
                    !roomMediaAvailable ||
                    !canJoinSession(session, now) ||
                    query.isFetching ||
                    !!query.error
                  }
                  onPress={join}
                >
                  Vào phòng học
                </SessionButton>
                <SessionButton
                  variant="paper"
                  disabled={query.isFetching}
                  onPress={() => {
                    void query.refetch();
                  }}
                >
                  Tải lại trạng thái
                </SessionButton>
              </SessionPanel>
            )}
          </>
        )}
      </SessionFeedback>
    </SessionPage>
  );
}
