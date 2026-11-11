import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FormNotice } from "@/components/FormNotice";
import { useSessionDetail } from "../hooks/use-sessions";
import { useSessionPartner } from "../hooks/use-session-partner";
import { useSessionClock } from "../hooks/use-session-clock";
import { useSessionsRuntime } from "../runtime";
import { SessionFeedback } from "../components/session-feedback";
import { SessionPage } from "../components/session-page";
import { RoomMedia, roomMediaAvailable } from "../components/room-media";
import { RoomLobby } from "../components/room-lobby";
import {
  canJoinSession,
  joinReason,
  sessionJoinReason,
  sessionRoomClosesAt,
} from "../utils/session-join";
import { sessionErrorMessage } from "../utils/session-read";

export function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useSessionsRuntime();
  return <SessionRoom key={`${runtime.key.join(":")}:${id}`} id={id} />;
}

function SessionRoom({ id }: Readonly<{ id: string }>) {
  const [attempt, setAttempt] = useState(0);
  const [startCamera, setStartCamera] = useState(false);
  const [startMicrophone, setStartMicrophone] = useState(false);
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
  const sharingScreen = useRef(false);
  const screenShareChanged = useCallback((value: boolean) => {
    sharingScreen.current = value;
  }, []);
  const callIsCurrent = useCallback(
    () =>
      runtime.isCurrent() &&
      focused.current &&
      (AppState.currentState !== "background" || sharingScreen.current) &&
      canJoinSession(sessionRef.current),
    [runtime.isCurrent],
  );
  const [notice, setNotice] = useState("");
  const terminal =
    !!session &&
    !["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"].includes(
      session.status,
    );
  const ended = !!session && now >= sessionRoomClosesAt(session);
  const joinable = canJoinSession(session, now);
  useEffect(() => {
    if (!session || terminal || ended || !runtime.enabled || !joinable) {
      intent.current++;
      setAttempt(0);
    }
  }, [session, terminal, ended, runtime.enabled, joinable]);
  const leave = useCallback(() => {
    sharingScreen.current = false;
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
        if (state === "background" && !sharingScreen.current) {
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
        sharingScreen.current = false;
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
                partnerAvatarUrl={partner.data?.avatarUrl}
                partnerIdentity={
                  id +
                  ":" +
                  (session.teacherId === runtime.userId
                    ? session.learnerId
                    : session.teacherId)
                }
                startCamera={startCamera}
                startMicrophone={startMicrophone}
                onScreenShareChange={screenShareChanged}
                onLeave={leave}
                onRetry={() => {
                  void retry();
                }}
                retrying={query.isFetching}
              />
            ) : (
              <RoomLobby
                partnerName={partner.data?.fullName ?? "Người trao đổi"}
                camera={startCamera}
                microphone={startMicrophone}
                onCameraChange={setStartCamera}
                onMicrophoneChange={setStartMicrophone}
                previewAvailable={roomMediaAvailable && !terminal && !ended}
                reason={
                  canJoinSession(session, now)
                    ? "Phòng học đã mở. Cho phép camera, micro khi được hỏi."
                    : joinReason(sessionJoinReason(session, now))
                }
                canJoin={
                  roomMediaAvailable &&
                  canJoinSession(session, now) &&
                  !query.isFetching &&
                  !query.error
                }
                refreshing={query.isFetching}
                onJoin={join}
                onRefresh={() => {
                  void query.refetch();
                }}
              />
            )}
          </>
        )}
      </SessionFeedback>
    </SessionPage>
  );
}
