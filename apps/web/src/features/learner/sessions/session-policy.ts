import type { LearningSession, LiveKitCredentials } from "../types";
export function canEnterSession(session: LearningSession, now = Date.now()) {
  const join = session.join;
  return (
    ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"].includes(
      session.status,
    ) &&
    (session.allowedActions === undefined ||
      session.allowedActions.includes("JOIN")) &&
    !!join?.canJoin &&
    !!join.opensAt &&
    !!join.closesAt &&
    now >= Date.parse(join.opensAt) &&
    now < Date.parse(join.closesAt)
  );
}
export function validRoomCredentials(
  value: LiveKitCredentials,
  sessionId: string,
  userId: string,
  now = Date.now(),
) {
  try {
    const url = new URL(value.serverUrl),
      local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "wss:" ||
        (process.env.NODE_ENV !== "production" &&
          local &&
          url.protocol === "ws:")) &&
      typeof value.participantToken === "string" &&
      !!value.participantToken &&
      value.participantIdentity === sessionId + ":" + userId &&
      typeof value.roomName === "string" &&
      !!value.roomName &&
      Date.parse(value.joinOpensAt) <= now &&
      now < Date.parse(value.joinClosesAt) &&
      Date.parse(value.expiresAt) > now &&
      Date.parse(value.expiresAt) <= Date.parse(value.joinClosesAt)
    );
  } catch {
    return false;
  }
}
export function mediaErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (["NotAllowedError", "PermissionDeniedError"].includes(name))
    return "Bạn chưa cấp quyền camera/micro. Kiểm tra quyền của trang trong trình duyệt rồi bật lại.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(name))
    return "Không tìm thấy camera hoặc micro. Bạn vẫn có thể nghe và xem đối tác.";
  if (["NotReadableError", "TrackStartError"].includes(name))
    return "Thiết bị đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.";
  return "Chưa bật được thiết bị. Bạn vẫn có thể nghe và xem; kiểm tra thiết bị rồi thử lại.";
}
export function vietnamInstant(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Chọn ngày giờ hợp lệ.");
  const date = new Date(local + ":00+07:00");
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16) !== local
  )
    throw new Error("Ngày giờ chưa hợp lệ.");
  return date.toISOString();
}
