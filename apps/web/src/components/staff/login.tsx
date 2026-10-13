"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/console/icon";
import { useStaffSession } from "./session";
export function StaffLogin() {
  const session = useStaffSession();
  const isAdmin = session.portal === "admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="staff-login">
      <section className="staff-login-intro">
        <Link
          className="staff-brand"
          href="/"
          aria-label="SkillHub — trang chủ"
        >
          <span className="logo">S</span> SkillHub
        </Link>
        <p className="staff-eyebrow">
          {isAdmin ? "KHÔNG GIAN QUẢN TRỊ" : "KHÔNG GIAN KIỂM DUYỆT"}
        </p>
        <h1>
          Cùng giữ SkillHub
          <br />
          đáng tin cậy.
        </h1>
        <p>
          {isAdmin
            ? "Quản lý tài khoản, danh mục kỹ năng và quy tắc kiểm duyệt cộng đồng."
            : "Xem xét bằng chứng, duyệt yêu cầu học và xử lý báo cáo của cộng đồng."}
        </p>
        <div className="staff-login-points">
          <span>
            <Icon name="shield" /> Xác minh kỹ năng
          </span>
          <span>
            <Icon name="flag" /> Kiểm duyệt yêu cầu học
          </span>
          <span>
            <Icon name="alert" /> Báo cáo & tranh chấp
          </span>
        </div>
      </section>
      <section className="card staff-login-card">
        <div className="card-body stack">
          <span className="badge badge-brand">DÀNH CHO NHÂN VIÊN</span>
          <h2>Đăng nhập {isAdmin ? "Admin" : "Staff"}</h2>
          <p className="muted">Sử dụng tài khoản được SkillHub phân quyền.</p>
          {(error || session.error) && (
            <p className="staff-error" role="alert">
              {error ?? session.error}
            </p>
          )}
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                await session.login(email.trim(), password);
                setPassword("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không thể đăng nhập.",
                );
              }
            }}
          >
            <label className="staff-field">
              <span>Email</span>
              <input
                type="email"
                required
                maxLength={320}
                autoComplete="username"
                value={email}
                disabled={session.busy}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  isAdmin ? "admin@skillhub.vn" : "staff@skillhub.vn"
                }
              />
            </label>
            <label className="staff-field">
              <span>Mật khẩu</span>
              <input
                type="password"
                required
                maxLength={1024}
                autoComplete="current-password"
                value={password}
                disabled={session.busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={session.busy}
            >
              {session.busy ? "Đang đăng nhập…" : "Đăng nhập"}
              <Icon name="right" size={16} />
            </button>
          </form>
          <div className="staff-login-tools">
            <button
              type="button"
              className="link"
              disabled={session.busy}
              onClick={async () => {
                try {
                  await session.logout();
                  setError(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Không thể kết thúc phiên.",
                  );
                }
              }}
            >
              Kết thúc phiên cũ
            </button>
            <button
              type="button"
              className="link"
              disabled={session.busy}
              onClick={session.refresh}
            >
              Kiểm tra lại kết nối
            </button>
          </div>
          <Link className="link" href="/">
            ← Quay lại trang chủ
          </Link>
        </div>
      </section>
    </main>
  );
}
