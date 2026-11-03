"use client";
import Link from "next/link";
import { useState } from "react";
export function UserLogin({
  onLogin,
  onReset,
  error,
}: Readonly<{
  onLogin: (email: string, password: string) => Promise<void>;
  onReset: () => Promise<void>;
  error?: string;
}>) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(error),
    [show, setShow] = useState(false);
  return (
    <main className="learner-login">
      <section className="learner-login-intro">
        <Link className="learner-brand" href="/">
          SkillHub<span>học cùng nhau</span>
        </Link>
        <p className="eyebrow">KHÔNG GIAN CỦA BẠN</p>
        <h1>
          Một kỹ năng mới.
          <br />
          Một người bạn đồng hành.
        </h1>
        <p>
          Đăng điều bạn muốn học, gặp người có thể hướng dẫn và cùng bắt đầu một
          buổi học ngay trên web.
        </p>
        <div className="learner-pills">
          <span>Đăng bài tìm người học</span>
          <span>Trao đổi trực tiếp</span>
          <span>Phòng học trực tuyến</span>
        </div>
      </section>
      <section className="learner-card learner-login-card">
        <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
        <h2>Đăng nhập người dùng</h2>
        <p className="muted">Tiếp tục hành trình học của bạn.</p>
        <form
          className="learner-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            const data = new FormData(event.currentTarget);
            setPending(true);
            setMessage(undefined);
            try {
              await onLogin(
                String(data.get("email")).trim(),
                String(data.get("password")),
              );
            } catch (cause) {
              setMessage(
                cause instanceof Error ? cause.message : "Không thể đăng nhập.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={320}
              disabled={pending}
              placeholder="ban@example.com"
            />
          </label>
          <label>
            Mật khẩu
            <div className="learner-password">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={1024}
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {show ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </label>
          {message && (
            <p className="learner-error" role="alert">
              {message}
            </p>
          )}
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Đang đăng nhập…" : "Đăng nhập và bắt đầu học"}
          </button>
        </form>
        <button
          className="learner-text-button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void onReset()
              .then(() =>
                setMessage("Đã kết thúc phiên cũ. Bạn có thể đăng nhập lại."),
              )
              .catch((cause: unknown) =>
                setMessage(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể đăng xuất.",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          Kết thúc phiên cũ / đổi tài khoản
        </button>
        <p className="muted">
          Bạn là nhân viên? <Link href="/staff">Staff</Link> ·{" "}
          <Link href="/admin">Admin</Link>
        </p>
      </section>
    </main>
  );
}
