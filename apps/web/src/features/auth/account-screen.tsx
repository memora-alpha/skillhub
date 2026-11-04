"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { accountRequest } from "./account-client";
export function AccountScreen({ mode }: { mode: "register" | "forgot" }) {
  const [step, setStep] = useState<"start" | "otp" | "reset" | "done">("start"),
    [email, setEmail] = useState(""),
    [proof, setProof] = useState<{ resetToken: string; expiresAt: string }>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState<string>();
  const busy = useRef(false);
  const registering = mode === "register";
  const title =
    step === "done"
      ? registering
        ? "Tài khoản đã được xác minh"
        : "Đã đặt lại mật khẩu"
      : step === "otp"
        ? "Kiểm tra email của bạn"
        : step === "reset"
          ? "Đặt mật khẩu mới"
          : registering
            ? "Bắt đầu hành trình mới"
            : "Quên mật khẩu?";
  async function submit(fields: FormData) {
    if (step === "start") {
      const address = String(fields.get("email")).trim();
      if (
        registering &&
        fields.get("password") !== fields.get("confirmPassword")
      )
        throw new Error("Hai mật khẩu chưa trùng khớp.");
      await accountRequest(
        registering ? "register" : "password/forgot",
        registering
          ? {
              email: address,
              fullName: String(fields.get("fullName")).trim(),
              password: String(fields.get("password")),
              confirmPassword: String(fields.get("confirmPassword")),
              agreeTerms: fields.get("agreeTerms") === "on",
              timezone: "Asia/Ho_Chi_Minh",
              locale: "vi",
            }
          : { email: address },
      );
      setEmail(address);
      setStep("otp");
      setNotice("Nếu yêu cầu hợp lệ, email hướng dẫn sẽ được gửi đến bạn.");
    } else if (step === "otp") {
      const body = { email, otpCode: String(fields.get("otpCode")) };
      if (registering) {
        await accountRequest("verification/verify", body);
        setStep("done");
      } else {
        const result = await accountRequest<{
          resetToken: string;
          expiresAt: string;
        }>("password/verify-otp", body);
        if (
          !result ||
          !/^[A-Za-z0-9_-]{43}$/.test(result.resetToken) ||
          !Number.isFinite(Date.parse(result.expiresAt))
        )
          throw new Error("Chưa xác minh được yêu cầu. Vui lòng thử lại.");
        setProof(result);
        setStep("reset");
      }
      setNotice(undefined);
    } else if (step === "reset") {
      if (!proof || Date.parse(proof.expiresAt) <= Date.now())
        throw new Error("Phiên đặt lại đã hết hạn. Hãy bắt đầu lại.");
      if (fields.get("newPassword") !== fields.get("confirmNewPassword"))
        throw new Error("Hai mật khẩu chưa trùng khớp.");
      await accountRequest("password/reset", {
        email,
        resetToken: proof.resetToken,
        newPassword: String(fields.get("newPassword")),
        confirmNewPassword: String(fields.get("confirmNewPassword")),
      });
      setProof(undefined);
      setStep("done");
    }
  }
  async function run(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa hoàn tất yêu cầu.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <span>S</span> SkillHub
      </Link>
      <div className="auth-grid">
        <section className="auth-intro">
          <p className="auth-eyebrow">HỌC CÙNG NHAU, TIẾN XA HƠN</p>
          <h1>
            Điều bạn biết,
            <br />
            <em>có thể giúp ai đó.</em>
          </h1>
          <p>
            Kết nối người đồng hành, chia sẻ kỹ năng và cùng tiến bộ qua từng
            buổi học.
          </p>
          <div className="auth-points">
            <span>Học trực tiếp 1:1</span>
            <span>Lộ trình rõ ràng</span>
            <span>Kết nối cộng đồng</span>
          </div>
        </section>
        <section className="auth-card" aria-labelledby="account-heading">
          <p className="auth-eyebrow">
            {registering ? "CHÀO MỪNG ĐẾN SKILLHUB" : "KHÔI PHỤC TÀI KHOẢN"}
          </p>
          <h2 id="account-heading">{title}</h2>
          <p>
            {step === "otp"
              ? "Nhập mã 6 chữ số gửi đến " + email
              : step === "done"
                ? "Bạn có thể đăng nhập bằng tài khoản của mình."
                : registering
                  ? "Tạo tài khoản để học điều bạn muốn và chia sẻ điều bạn biết."
                  : "Làm theo hướng dẫn qua email để lấy lại quyền truy cập."}
          </p>
          {step === "done" ? (
            <Link className="auth-submit" href="/login">
              Đến trang đăng nhập →
            </Link>
          ) : (
            <form
              aria-busy={pending}
              key={step}
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                void run(() => submit(fields));
              }}
            >
              {step === "start" ? (
                <>
                  {registering && (
                    <>
                      <label htmlFor="account-name">Họ và tên</label>
                      <input
                        id="account-name"
                        name="fullName"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        disabled={pending}
                      />
                    </>
                  )}
                  <label htmlFor="account-email">Email</label>
                  <input
                    id="account-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    disabled={pending}
                  />
                  {registering && (
                    <>
                      <label htmlFor="account-password">Mật khẩu</label>
                      <input
                        id="account-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={64}
                        required
                        disabled={pending}
                      />
                      <small>
                        8–64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc
                        biệt.
                      </small>
                      <label htmlFor="account-confirm">Nhập lại mật khẩu</label>
                      <input
                        id="account-confirm"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={64}
                        required
                        disabled={pending}
                      />
                      <label className="auth-consent">
                        <input
                          type="checkbox"
                          name="agreeTerms"
                          required
                          disabled={pending}
                        />{" "}
                        <span>
                          Tôi đồng ý với{" "}
                          <Link
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            điều khoản sử dụng
                          </Link>{" "}
                          và{" "}
                          <Link
                            href="/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            chính sách bảo mật
                          </Link>{" "}
                          của SkillHub.
                        </span>
                      </label>
                    </>
                  )}
                </>
              ) : step === "otp" ? (
                <>
                  <label htmlFor="account-otp">Mã xác nhận</label>
                  <input
                    id="account-otp"
                    name="otpCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    disabled={pending}
                    placeholder="000000"
                  />
                </>
              ) : (
                <>
                  <label htmlFor="new-password">Mật khẩu mới</label>
                  <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={64}
                    required
                    disabled={pending}
                  />
                  <small>Gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
                  <label htmlFor="new-password-confirm">
                    Nhập lại mật khẩu mới
                  </label>
                  <input
                    id="new-password-confirm"
                    name="confirmNewPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={64}
                    required
                    disabled={pending}
                  />
                </>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button className="auth-submit" disabled={pending}>
                {pending
                  ? "Đang xử lý…"
                  : step === "otp"
                    ? "Xác minh mã"
                    : step === "reset"
                      ? "Lưu mật khẩu mới"
                      : registering
                        ? "Tạo tài khoản"
                        : "Gửi mã khôi phục"}{" "}
                →
              </button>
              {step === "otp" && (
                <button
                  type="button"
                  className="auth-reset"
                  disabled={pending}
                  onClick={() => {
                    void run(async () => {
                      await accountRequest(
                        registering ? "verification/resend" : "password/forgot",
                        { email },
                      );
                      setNotice(
                        "Đã gửi yêu cầu cấp mã mới. Vui lòng kiểm tra email.",
                      );
                    });
                  }}
                >
                  Gửi lại mã xác nhận
                </button>
              )}
              {step !== "start" && (
                <button
                  type="button"
                  className="auth-reset"
                  disabled={pending}
                  onClick={() => {
                    setStep("start");
                    setProof(undefined);
                    setError(undefined);
                    setNotice(undefined);
                  }}
                >
                  Bắt đầu lại / đổi email
                </button>
              )}
            </form>
          )}
          <p className="auth-account-links">
            <Link href="/login">← Đăng nhập</Link>
            {!registering && <Link href="/register">Tạo tài khoản</Link>}
          </p>
        </section>
      </div>
    </main>
  );
}
