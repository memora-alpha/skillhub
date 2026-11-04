import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Switch, View } from "react-native";
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
import { RoomPreview } from "../components/room-preview";
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
            <SessionPanel title="Buổi học trực tuyến">
              <SessionCopy>
                {partner.data?.fullName ?? "Người trao đổi"}
              </SessionCopy>
              <SessionCopy muted>
                Bạn có thể vào phòng trong thời gian hệ thống cho phép và vào
                lại khi mất kết nối trong giờ học. Camera và micro chỉ bật theo
                lựa chọn của bạn. Chat trong phòng chỉ dùng cho phiên học, không
                lưu lịch sử. Rời phòng không xác nhận hoàn thành buổi học.
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
              <SessionPanel title="Chuẩn bị vào học">
                {startCamera && !terminal && !ended && (
                  <RoomPreview onUnavailable={() => setStartCamera(false)} />
                )}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SessionCopy>Bật camera khi vào phòng</SessionCopy>
                  </View>
                  <Switch
                    accessibilityLabel="Bật camera khi vào phòng"
                    value={startCamera}
                    onValueChange={setStartCamera}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SessionCopy>Bật micro khi vào phòng</SessionCopy>
                  </View>
                  <Switch
                    accessibilityLabel="Bật micro khi vào phòng"
                    value={startMicrophone}
                    onValueChange={setStartMicrophone}
                  />
                </View>
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
