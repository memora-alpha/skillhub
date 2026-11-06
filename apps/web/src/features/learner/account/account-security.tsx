"use client";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { Feedback } from "../components/common";
export function AccountSecurity() {
  const { logout } = useUserSession();
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  return (
    <section>
      <h3>Bảo vệ tài khoản</h3>
      <p>
        Đăng xuất mọi thiết bị sẽ kết thúc cả phiên hiện tại. Bạn cần đăng nhập
        lại trên các thiết bị đang dùng.
      </p>
      {!reviewing ? (
        <button
          type="button"
          className="btn"
          onClick={() => setReviewing(true)}
        >
          Đăng xuất mọi thiết bị
        </button>
      ) : (
        <div className="learner-actions">
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setPending(true);
              setError(undefined);
              try {
                await logout(true);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Chưa xác nhận được việc kết thúc mọi phiên. Hãy thử lại.",
                );
              } finally {
                lock.current = false;
                setPending(false);
              }
            }}
          >
            {pending ? "Đang kết thúc các phiên…" : "Xác nhận đăng xuất tất cả"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => setReviewing(false)}
          >
            Quay lại
          </button>
        </div>
      )}
      <Feedback error={error} />
    </section>
  );
}
