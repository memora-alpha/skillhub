import type { SessionDestination } from "@/lib/auth/session";

export class LoginSessionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type SessionReply = {
  data: SessionDestination | null;
  meta?: { refreshRequired?: boolean; serverRevoked?: boolean };
};
const destinations = {
  USER: "/learn",
  STAFF: "/staff",
  ADMIN: "/admin",
} as const;

async function requestSession(
  method = "GET",
  body?: unknown,
  refresh = false,
  all = false,
): Promise<SessionReply> {
  let response: Response;
  try {
    response = await fetch(
      `/api/auth/session${refresh ? "/refresh" : all ? "/all" : ""}`,
      {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  } catch {
    throw new LoginSessionError(
      0,
      "Chưa thể kết nối máy chủ. Vui lòng thử lại sau.",
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.",
      403: "Tài khoản chưa được phép truy cập. Vui lòng kiểm tra xác minh hoặc liên hệ hỗ trợ.",
      409: "Bạn đang có phiên đăng nhập. Kết thúc phiên cũ để đổi tài khoản.",
      429: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
    };
    throw new LoginSessionError(
      response.status,
      messages[response.status] ??
        "Máy chủ SkillHub tạm thời không khả dụng. Vui lòng thử lại sau.",
    );
  }
  let value: { success?: unknown; data?: unknown; meta?: SessionReply["meta"] };
  try {
    value = await response.json();
  } catch {
    throw new LoginSessionError(502, "Phản hồi đăng nhập không hợp lệ.");
  }
  if (value?.success !== true || !("data" in value))
    throw new LoginSessionError(502, "Phản hồi đăng nhập không hợp lệ.");
  if (value.data !== null) {
    const candidate = value.data as SessionDestination;
    if (
      !candidate ||
      !Object.hasOwn(destinations, candidate.role) ||
      destinations[candidate.role] !== candidate.destination
    )
      throw new LoginSessionError(
        502,
        "Chưa xác định được khu vực của tài khoản.",
      );
  }
  return value as SessionReply;
}

let restoration: Promise<SessionDestination | null> | undefined;
export function restoreLoginSession() {
  const work = async () => {
    const result = await requestSession();
    if (result.data || result.meta?.refreshRequired !== true)
      return result.data;
    try {
      return (await requestSession("POST", {}, true)).data;
    } catch (cause) {
      if (cause instanceof LoginSessionError && cause.status === 401)
        return null;
      throw cause;
    }
  };
  // Share the actual flight as well as the cross-tab lock. StrictMode mounts
  // must not each rotate the same refresh credential.
  restoration ??= (
    typeof navigator !== "undefined" && "locks" in navigator
      ? navigator.locks.request("skillhub-session", work)
      : work()
  ).finally(() => {
    restoration = undefined;
  });
  return restoration;
}
export async function signIn(email: string, password: string) {
  const result = await requestSession("POST", { email, password });
  if (!result.data)
    throw new LoginSessionError(502, "Phản hồi đăng nhập không hợp lệ.");
  return result.data;
}
export async function endLoginSession() {
  return requestSession("DELETE");
}
export async function endAllLoginSessions() {
  const result = await requestSession("POST", {}, false, true);
  if (result.data !== null || result.meta?.serverRevoked !== true)
    throw new LoginSessionError(
      502,
      "Chưa xác nhận được việc kết thúc mọi phiên. Hãy kiểm tra lại.",
    );
  return result;
}
