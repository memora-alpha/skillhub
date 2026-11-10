"use client";
import { formText } from "../learner/components/form-data";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/password-input";
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
  const [error, setError] = useState<string>();
  const [canReset, setCanReset] = useState(false);
  const busy = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const rememberInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("skillhub:login-email");
      if (saved && saved.length <= 254) {
        if (emailInput.current) emailInput.current.value = saved;
        if (rememberInput.current) rememberInput.current.checked = true;
      }
    } catch {
      // Login remains available when browser storage is blocked.
    }
  }, []);
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

  let submitLabel: string;
  if (checking) submitLabel = "Đang kiểm tra phiên…";
  else if (pending) submitLabel = "Đang đăng nhập…";
  else submitLabel = "Đăng nhập";
  return (
    <main className="auth-page auth-login-page">
      <header className="auth-topbar">
        <Link
          href="/"
          className="auth-home"
          aria-label="Quay lại trang chủ"
          title="Quay lại trang chủ"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 5-7 7 7 7M5 12h14" />
          </svg>
        </Link>
        <Link href="/" className="auth-brand">
          <span>S</span> SkillHub
        </Link>
      </header>
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
                const email = formText(data, "email").trim();
                const destination = await signIn(
                  email,
                  formText(data, "password"),
                );
                try {
                  if (data.get("rememberEmail"))
                    localStorage.setItem("skillhub:login-email", email);
                  else localStorage.removeItem("skillhub:login-email");
                } catch {
                  // A storage restriction must not prevent a successful sign-in.
                }
                enter(destination, true);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể đăng nhập. Vui lòng thử lại.",
                );
                setCanReset(
                  cause instanceof LoginSessionError && cause.status === 409,
                );
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          >
            <label htmlFor="login-email">Email</label>
            <input
              ref={emailInput}
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="ban@example.com"
              required
              minLength={5}
              maxLength={254}
              disabled={checking || pending}
            />
            <label htmlFor="login-password">Mật khẩu</label>
            <PasswordInput
              id="login-password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={64}
              disabled={checking || pending}
            />
            <label className="auth-remember">
              <input
                type="checkbox"
                ref={rememberInput}
                name="rememberEmail"
                disabled={checking || pending}
                onChange={(event) => {
                  if (!event.target.checked) {
                    try {
                      localStorage.removeItem("skillhub:login-email");
                    } catch {
                      /* Storage may be blocked. */
                    }
                  }
                }}
              />
              <span>Ghi nhớ tài khoản cho lần sau</span>
            </label>
            <div className="auth-feedback" aria-live="polite">
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="auth-submit"
              disabled={checking || pending}
            >
              {submitLabel}
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
        </section>
      </div>
    </main>
  );
}
