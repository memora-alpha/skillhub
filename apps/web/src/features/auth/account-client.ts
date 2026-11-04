export async function accountRequest<T = unknown>(
  action: string,
  body: unknown,
): Promise<T | undefined> {
  let response: Response;
  try {
    response = await fetch("/api/auth/account/" + action, {
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
      OTP_EXPIRED: "Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.",
      OTP_ATTEMPTS_EXCEEDED:
        "Bạn đã nhập sai nhiều lần. Vui lòng yêu cầu mã mới.",
      EMAIL_ALREADY_EXISTS:
        "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
      INVALID_RESET_TOKEN:
        "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng xác minh lại OTP.",
    };
    throw new Error(
      messages[value?.message] ??
        (response.status === 429
          ? "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ rồi thử lại."
          : response.status >= 500
            ? "Máy chủ tạm thời không khả dụng. Vui lòng thử lại sau."
            : "Thông tin chưa hợp lệ hoặc mã đã hết hạn. Kiểm tra lại và thử lại."),
    );
  }
  if (value?.success !== true) throw new Error("Phản hồi máy chủ chưa hợp lệ.");
  return value.data as T;
}
