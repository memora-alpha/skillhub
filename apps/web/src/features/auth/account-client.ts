import { apiFetch } from "@/lib/network/api-fetch";
export async function accountRequest<T = unknown>(
  action: string,
  body: unknown,
): Promise<T | undefined> {
  let response: Response;
  try {
    response = await apiFetch("/api/auth/account/" + action, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Chưa kết nối được máy chủ. Hãy kiểm tra email hoặc trạng thái trước khi gửi lại.",
    );
  }
  if (response.status === 204) return;
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const messages: Record<string, string> = {
      OTP_INVALID: "Mã xác nhận chưa đúng.",
      OTP_INVALID_OR_EXPIRED:
        "Mã chưa đúng, đã hết hạn hoặc thao tác OTP đang bị giới hạn. Gửi lại mã không gỡ giới hạn. Bạn vẫn có thể đăng nhập bằng mật khẩu hợp lệ hoặc chờ rồi thử lại.",
      RESET_TOKEN_INVALID_OR_EXPIRED:
        "Phiên đặt lại mật khẩu không còn hợp lệ. Hãy bắt đầu lại bước khôi phục.",
      OTP_EXPIRED: "Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.",
      OTP_ATTEMPTS_EXCEEDED:
        "Bạn đã nhập sai nhiều lần. Hãy chờ theo giới hạn của máy chủ; gửi lại mã không đặt lại bộ đếm.",
      EMAIL_ALREADY_EXISTS:
        "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
      EMAIL_ALREADY_REGISTERED:
        "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
      OTP_EMAIL_COOLDOWN:
        "Thao tác OTP đang bị giới hạn. Hãy chờ rồi thử lại; mã mới không gỡ thời gian khóa.",
      INVALID_RESET_TOKEN:
        "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng xác minh lại OTP.",
    };
    throw new Error(
      messages[value?.message] ?? accountFailureMessage(response.status),
    );
  }
  if (value?.success !== true) throw new Error("Phản hồi máy chủ chưa hợp lệ.");
  return value.data as T;
}

function accountFailureMessage(status: number) {
  if (status === 429)
    return "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ rồi thử lại.";
  if (status >= 500)
    return "Máy chủ tạm thời không khả dụng. Vui lòng thử lại sau.";
  return "Thông tin chưa hợp lệ hoặc mã đã hết hạn. Kiểm tra lại và thử lại.";
}
