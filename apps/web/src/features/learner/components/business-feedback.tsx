"use client";
import Link from "next/link";
import { useUserSession } from "../auth/session";
import { ProfileName } from "./profile-name";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? formatVietnamDateTime(v)
    : "chưa có giờ";
export function BusinessFeedback({
  code,
  details,
}: Readonly<{ code: string; details: unknown }>) {
  const { actor } = useUserSession();
  const data = record(details);
  const ids = Array.isArray(data.userIds) ? data.userIds.filter(uuid) : [];
  if (code === "INSUFFICIENT_AVAILABLE_CREDIT" && ids.length)
    return (
      <div className="learner-notice">
        <p>Những người cần bổ sung Credit:</p>
        <ul>
          {ids.map((id) => (
            <li key={id}>
              {id === actor.userId ? (
                <>
                  Bạn · <Link href="/learn/wallet/topup">Nạp thêm Credit</Link>
                </>
              ) : (
                <>
                  <ProfileName id={id} /> · Nhờ đối tác kiểm tra số dư khả dụng.
                </>
              )}
            </li>
          ))}
        </ul>
        <p>
          Lần chốt này chưa được xác nhận thành công. Kiểm tra lại thỏa thuận
          trước khi thử tiếp.
        </p>
      </div>
    );
  if (code === "SCHEDULE_CONFLICT" && Array.isArray(data.conflicts))
    return (
      <div className="learner-error">
        <p>Các khoảng lịch bị trùng:</p>
        <ul>
          {data.conflicts.slice(0, 100).map((item) => {
            const conflict = record(item),
              proposed = record(conflict.proposed),
              compared = record(conflict.compared);
            const affected = Array.isArray(conflict.affectedUserIds)
              ? conflict.affectedUserIds.filter(uuid)
              : [];
            return (
              <li
                key={JSON.stringify([
                  conflict.type,
                  proposed.planId,
                  proposed.learningPlanId,
                  proposed.sessionNo,
                  proposed.startAt,
                  proposed.endAt,
                  compared.planId,
                  compared.learningPlanId,
                  compared.sessionId,
                  compared.sessionNo,
                  compared.startAt,
                  compared.endAt,
                  conflict.overlapStartAt,
                  conflict.overlapEndAt,
                  conflict.affectedUserIds,
                ])}
              >
                Buổi đề xuất{" "}
                {typeof proposed.sessionNo === "number"
                  ? proposed.sessionNo
                  : ""}{" "}
                ({date(proposed.startAt)} – {date(proposed.endAt)}) trùng{" "}
                {conflict.type === "INTERNAL"
                  ? "buổi khác trong lịch đang đề xuất"
                  : "buổi học đã chốt"}
                {typeof compared.sessionNo === "number"
                  ? " số " + compared.sessionNo
                  : ""}
                .<br />
                Khoảng trùng: {date(conflict.overlapStartAt)} –{" "}
                {date(conflict.overlapEndAt)}.<br />
                Người bị ảnh hưởng:{" "}
                {affected.map((id, i) => (
                  <span key={id}>
                    {i ? ", " : ""}
                    {id === actor.userId ? "Bạn" : <ProfileName id={id} />}
                  </span>
                ))}
                {uuid(compared.sessionId) && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={"/learn/sessions/" + compared.sessionId}>
                      Xem buổi bị trùng
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  if (uuid(data.existingPaymentId))
    return (
      <p className="learner-notice">
        <Link href={"/learn/wallet/topup?paymentId=" + data.existingPaymentId}>
          Mở lệnh thanh toán cần xử lý
        </Link>
      </p>
    );
  return null;
}
