"use client";
import { formText } from "../learner/components/form-data";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { accountRequest } from "./account-client";
import { PasswordFields } from "./password-fields";
import { strongPassword } from "./password-policy";
export function AccountScreen({
  mode,
}: Readonly<{ mode: "register" | "forgot" }>) {
  const [step, setStep] = useState<"start" | "otp" | "reset" | "done">("start"),
    [email, setEmail] = useState(""),
    [proof, setProof] = useState<{ resetToken: string; expiresAt: string }>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState<string>();
  const busy = useRef(false);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (step !== "otp") return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const registering = mode === "register";
  const titles = {
    start: registering ? "Bắt đầu hành trình mới" : "Quên mật khẩu?",
    otp: "Kiểm tra email của bạn",
    reset: "Đặt mật khẩu mới",
    done: registering ? "Tài khoản đã được xác minh" : "Đã đặt lại mật khẩu",
  };
  const descriptions = {
    start: registering
      ? "Tạo tài khoản để học điều bạn muốn và chia sẻ điều bạn biết."
      : "Làm theo hướng dẫn qua email để lấy lại quyền truy cập.",
    otp: "Nhập mã 6 chữ số gửi đến " + email,
    reset: registering
      ? "Tạo tài khoản để học điều bạn muốn và chia sẻ điều bạn biết."
      : "Làm theo hướng dẫn qua email để lấy lại quyền truy cập.",
    done: "Bạn có thể đăng nhập bằng tài khoản của mình.",
  };
  const submitLabels = {
    start: registering ? "Tạo tài khoản" : "Gửi mã khôi phục",
    otp: "Xác minh mã",
    reset: "Lưu mật khẩu mới",
    done: "",
  };
  async function submitStart(fields: FormData) {
    const address = formText(fields, "email").trim();
    if (registering && fields.get("password") !== fields.get("confirmPassword"))
      throw new Error("Hai mật khẩu chưa trùng khớp.");
    if (registering && !strongPassword(formText(fields, "password")))
      throw new Error("Mật khẩu chưa đáp ứng đủ các yêu cầu bên dưới.");
    await accountRequest(
      registering ? "register" : "password/forgot",
      registering
        ? {
            email: address,
            fullName: formText(fields, "fullName").trim(),
            password: formText(fields, "password"),
            confirmPassword: formText(fields, "confirmPassword"),
            agreeTerms: fields.get("agreeTerms") === "on",
            timezone: "Asia/Ho_Chi_Minh",
            locale: "vi",
          }
        : { email: address },
    );
    setEmail(address);
    setClock(Date.now());
    setResendAt(Date.now() + 60000);
    setStep("otp");
    setNotice(
      "Nếu yêu cầu hợp lệ, email hướng dẫn sẽ được gửi đến bạn. Nếu email đã có tài khoản, hãy đăng nhập hoặc khôi phục mật khẩu.",
    );
  }
  async function submitOtp(fields: FormData) {
    const body = { email, otpCode: formText(fields, "otpCode") };
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
  }
  async function submitReset(fields: FormData) {
    if (!proof || Date.parse(proof.expiresAt) <= Date.now())
      throw new Error("Phiên đặt lại đã hết hạn. Hãy bắt đầu lại.");
    if (fields.get("newPassword") !== fields.get("confirmNewPassword"))
      throw new Error("Hai mật khẩu chưa trùng khớp.");
    if (!strongPassword(formText(fields, "newPassword")))
      throw new Error("Mật khẩu mới chưa đáp ứng đủ các yêu cầu.");
    await accountRequest("password/reset", {
      email,
      resetToken: proof.resetToken,
      newPassword: formText(fields, "newPassword"),
      confirmNewPassword: formText(fields, "confirmNewPassword"),
    });
    setProof(undefined);
    setStep("done");
  }
  async function submit(fields: FormData) {
    if (step === "start") return submitStart(fields);
    if (step === "otp") return submitOtp(fields);
    if (step === "reset") return submitReset(fields);
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
          <h2 id="account-heading">{titles[step]}</h2>
          <p>{descriptions[step]}</p>
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
              <AccountFields
                step={step}
                registering={registering}
                pending={pending}
              />
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p>
                  <output>{notice}</output>
                </p>
              )}
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Đang xử lý…" : submitLabels[step]} →
              </button>
              {step === "otp" && (
                <button
                  type="button"
                  className="auth-reset"
                  disabled={pending || resendSeconds > 0}
                  onClick={() => {
                    if (Date.now() < resendAt) return;
                    void run(async () => {
                      await accountRequest(
                        registering ? "verification/resend" : "password/forgot",
                        { email },
                      );
                      setClock(Date.now());
                      setResendAt(Date.now() + 60000);
                      setNotice(
                        "Đã gửi yêu cầu cấp mã mới. Vui lòng kiểm tra email.",
                      );
                    });
                  }}
                >
                  {resendSeconds > 0
                    ? `Gửi lại mã sau ${resendSeconds}s`
                    : "Gửi lại mã xác nhận"}
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
            {registering && (
              <Link href="/forgot-password">Khôi phục mật khẩu</Link>
            )}
            {!registering && <Link href="/register">Tạo tài khoản</Link>}
          </p>
        </section>
      </div>
    </main>
  );
}

function AccountFields({
  step,
  registering,
  pending,
}: Readonly<{ step: string; registering: boolean; pending: boolean }>) {
  if (step === "start")
    return (
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
            <PasswordFields registering pending={pending} />
            <label className="auth-consent">
              <input
                type="checkbox"
                name="agreeTerms"
                required
                disabled={pending}
              />{" "}
              <span>
                Tôi đồng ý với{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer">
                  điều khoản sử dụng
                </Link>{" "}
                và{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                  chính sách bảo mật
                </Link>{" "}
                của SkillHub.
              </span>
            </label>
          </>
        )}
      </>
    );
  if (step === "otp")
    return (
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
        <small>
          {registering
            ? "Mã đăng ký gồm 6 chữ số, có hiệu lực 5 phút. "
            : "Nhập mã 6 chữ số từ email khôi phục. "}
          Chỉ mã mới nhất còn hiệu lực. Gửi lại mã hoặc bắt đầu lại không gỡ
          giới hạn theo email. Đồng hồ gửi lại chỉ là hướng dẫn trên thiết bị
          này.
        </small>
      </>
    );
  return (
    <>
      <PasswordFields registering={false} pending={pending} />
    </>
  );
}
