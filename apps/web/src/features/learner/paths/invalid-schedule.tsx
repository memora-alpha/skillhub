"use client";
import { UserApiError } from "../api/client";
import { formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import styles from "./path-detail.module.css";

type InvalidItem = {
  planId: string;
  scheduleId: string;
  sessionNo: number;
  startAt: string;
  endAt: string;
  reasons: string[];
};

const reasons: Record<string, string> = {
  START_NOT_IN_FUTURE: "Giờ bắt đầu đã qua. Hãy chọn thời gian mới.",
  END_NOT_AFTER_START: "Giờ kết thúc phải sau giờ bắt đầu.",
  DURATION_TOO_SHORT: "Thời lượng buổi học ngắn hơn mức cho phép.",
  DURATION_TOO_LONG: "Thời lượng buổi học dài hơn mức cho phép.",
};

export function invalidScheduleItems(cause: unknown): InvalidItem[] {
  if (
    !(cause instanceof UserApiError) ||
    cause.code !== "INVALID_SCHEDULE_ITEMS" ||
    !cause.details ||
    typeof cause.details !== "object"
  )
    return [];
  const raw = (cause.details as Record<string, unknown>).invalidItems;
  if (!Array.isArray(raw) || raw.length > 200) return [];
  return raw.filter((value): value is InvalidItem => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return (
      typeof item.planId === "string" &&
      /^[0-9a-f-]{36}$/i.test(item.planId) &&
      typeof item.scheduleId === "string" &&
      Number.isSafeInteger(item.sessionNo) &&
      Number(item.sessionNo) > 0 &&
      typeof item.startAt === "string" &&
      Number.isFinite(Date.parse(item.startAt)) &&
      typeof item.endAt === "string" &&
      Number.isFinite(Date.parse(item.endAt)) &&
      Array.isArray(item.reasons) &&
      item.reasons.every((reason) => typeof reason === "string")
    );
  });
}

export function InvalidScheduleNotice({
  error,
  onEdit,
}: Readonly<{ error: unknown; onEdit: (planId: string) => void }>) {
  const items = invalidScheduleItems(error);
  if (!items.length) return null;
  const details = (error as UserApiError).details as Record<string, unknown>;
  const duration = details.durationMinutes as
    { min?: unknown; max?: unknown } | undefined;
  const evaluatedAt =
    typeof details.evaluatedAt === "string" &&
    Number.isFinite(Date.parse(details.evaluatedAt))
      ? details.evaluatedAt
      : undefined;

  return (
    <section className={styles.invalidCard} aria-label="Các buổi cần sửa lịch">
      <div>
        <h3>Điều chỉnh lịch trước khi chốt</h3>
        {duration &&
          Number.isSafeInteger(duration.min) &&
          Number.isSafeInteger(duration.max) && (
            <p className={styles.metaNote}>
              Mỗi buổi cần từ {String(duration.min)} đến {String(duration.max)}{" "}
              phút.
            </p>
          )}
        {evaluatedAt && (
          <small className={styles.metaNote}>
            Kiểm tra lúc {formatTime(evaluatedAt)}
          </small>
        )}
      </div>

      {items.map((item) => (
        <div
          key={`${item.scheduleId}:${item.sessionNo}`}
          className={styles.invalidItem}
        >
          <strong>
            Buổi {item.sessionNo} · {formatTime(item.startAt)} –{" "}
            {formatTime(item.endAt)}
          </strong>
          <ul>
            {item.reasons.map((reason) => (
              <li key={reason}>
                {reasons[reason] ??
                  "Lịch buổi này chưa hợp lệ. Kiểm tra và chọn lại thời gian."}
              </li>
            ))}
          </ul>
          <div className={styles.actionRow}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEdit(item.planId)}
            >
              Sửa lịch kế hoạch này
              <ProductIcon name="arrow" size={14} />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
