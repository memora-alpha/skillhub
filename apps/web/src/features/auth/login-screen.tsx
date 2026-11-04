"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SessionDestination } from "@/lib/auth/session";
import { announceSessionChange } from "./session-sync";
import {
  LoginSessionError,
  restoreLoginSession,
  signIn,
  endLoginSession,
} from "./session-client";

function enter(value: SessionDestination | null, announce = false) {
  if (!value || !["/learn", "/staff", "/admin"].includes(value.destination))
    throw new Error("Chưa xác định được khu vực của tài khoản.");
  if (announce) announceSessionChange();
  window.location.replace(value.destination);
}

export function LoginScreen() {
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [canReset, setCanReset] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const work = restoreLoginSession();
    void work
      .then((value) => {
        if (active && value) enter(value);
      })
      .catch((cause: unknown) => {
        if (
          !active ||
          (cause instanceof LoginSessionError && cause.status === 401)
        )
          return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể kiểm tra phiên đăng nhập.",
        );
        setCanReset(cause instanceof LoginSessionError && cause.status === 409);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        <span>S</span> SkillHub
      </Link>
      <div className="auth-grid">
        <section className="auth-intro">
          <p className="auth-eyebrow">HỌC CÙNG NHAU, TIẾN XA HƠN</p>
          <h1>
            Chia sẻ điều bạn biết.
            <br />
            <em>Học điều bạn muốn.</em>
          </h1>
          <p>
            Một tài khoản, một nơi bắt đầu. Đăng nhập để tiếp tục hành trình của
            bạn cùng SkillHub.
          </p>
          <div className="auth-points">
            <span>Học trực tiếp 1:1</span>
            <span>Lộ trình rõ ràng</span>
            <span>Kết nối cộng đồng</span>
          </div>
        </section>
        <section className="auth-card" aria-labelledby="login-heading">
          <p className="auth-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2 id="login-heading">Đăng nhập SkillHub</h2>
          <p>Tiếp tục từ nơi bạn đã bắt đầu.</p>
          <form
            aria-busy={checking || pending}
            onSubmit={async (event) => {
              event.preventDefault();
              if (checking || busy.current) return;
              busy.current = true;
              setPending(true);
              setError(undefined);
              const data = new FormData(event.currentTarget);
              try {
                enter(
                  await signIn(
                    String(data.get("email")).trim(),
                    String(data.get("password")),
                  ),
                  true,
                );
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể đăng nhập. Vui lòng thử lại.",
                );
                setCanReset(true);
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          >
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="ban@example.com"
              required
              maxLength={320}
              disabled={checking || pending}
            />
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="auth-password">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={1024}
                disabled={checking || pending}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-controls="login-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <div className="auth-feedback" aria-live="polite">
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <button className="auth-submit" disabled={checking || pending}>
              {checking
                ? "Đang kiểm tra phiên…"
                : pending
                  ? "Đang đăng nhập…"
                  : "Đăng nhập"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-account-links">
            <Link href="/forgot-password">Quên mật khẩu?</Link>
            <Link href="/register">Tạo tài khoản</Link>
          </p>
          <div className="auth-tools">
            {canReset && (
              <button
                type="button"
                className="auth-reset"
                disabled={checking || pending}
                onClick={async () => {
                  if (checking || busy.current) return;
                  busy.current = true;
                  setPending(true);
                  try {
                    await endLoginSession();
                    announceSessionChange();
                    setError(undefined);
                    setCanReset(false);
                  } catch {
                    setError("Chưa thể kết thúc phiên. Vui lòng thử lại.");
                  } finally {
                    busy.current = false;
                    setPending(false);
                  }
                }}
              >
                Kết thúc phiên cũ / đổi tài khoản
              </button>
            )}
          </div>
          <Link className="auth-back" href="/">
            ← Quay lại trang chủ
          </Link>
        </section>
      </div>
    </main>
  );
}
