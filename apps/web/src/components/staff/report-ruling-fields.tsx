"use client";
import Link from "next/link";
import type { ReportCaseDetail } from "@/lib/staff/types";
import type { ResolutionDraft } from "@/lib/staff/report-resolution";
import { reportRulingContext } from "@/lib/staff/report-ruling";
import { StaffApiError } from "@/lib/staff/client";

export function ReportRulingFields({
  item,
  value,
  onChange,
  admin = false,
}: Readonly<{
  item: ReportCaseDetail;
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  admin?: boolean;
}>) {
  const context = reportRulingContext(item);
  const options = item.resolutionOptions;
  const choice = (code: string) =>
    options?.noShowRulings.find((row) => row.value === code);
  const blocked = choice("EXCUSE")?.blockedReason;
  const unavailable = (code: string) =>
    !!options && choice(code)?.allowed !== true;
  const cancellationBlocked =
    context.cancellation &&
    options?.cancellationMakeupRulings?.every((row) => !row.allowed);
  const reporterBlocked =
    !!item.reporterId &&
    !!options &&
    !options.eligibleMakeupUserIds.includes(item.reporterId);
  const makeupLabel = options?.obligationsEnded
    ? "Chấp nhận lý do theo quyết định dừng lộ trình"
    : options?.makeupAlreadyGranted
      ? "Gia hạn đặt lịch của lượt học bù đã cấp"
      : "Chấp nhận lý do và yêu cầu học bù";
  const participantLabel = (id: string) =>
    id === item.session?.teacherId ? "Người dạy" : "Người học";
  const showMakeupUser =
    context.needsMakeupUser && value.noShowRuling === "EXCUSE";
  if (!context.attendance && !context.cancellation) return null;
  return (
    <section
      className="stack report-ruling-fields"
      aria-label="Kết quả xử lý buổi học"
    >
      <h3 className="sub-title">Kết quả xử lý buổi học</h3>
      <p className="muted">
        Chọn theo bằng chứng của buổi học. Kiểm tra điều kiện và tác động của
        phương án trước khi xác nhận.
      </p>
      {options?.obligationsEnded && (
        <p className="notice notice-info">
          Lộ trình đã được chấp thuận dừng. Chấp nhận lý do sẽ chốt kết quả điểm
          danh, không tạo nghĩa vụ học bù mới.
        </p>
      )}
      {context.attendance && blocked && (
        <div className="notice notice-warn" role="status">
          <div>
            <strong>Không thể cấp học bù cho phương án hiện tại.</strong>
            <p>{new StaffApiError(409, blocked).message}</p>
            <p>
              Chỉ ghi nhận hoàn thành khi có bằng chứng buổi học đã hoàn thành.
              Nếu chưa đủ căn cứ, quay lại yêu cầu bổ sung thông tin; nếu hai
              bên không thể tiếp tục, xem xét dừng lộ trình.
            </p>
            {admin && item.path && (
              <Link
                className="link"
                href={`/admin/learning-paths/${item.path.id}`}
              >
                Xem lộ trình và các yêu cầu dừng
              </Link>
            )}
          </div>
        </div>
      )}
      {cancellationBlocked && (
        <p className="notice notice-warn">
          Buổi học chưa có lượt học bù từ yêu cầu hủy hợp lệ để gia hạn hoặc
          chốt kết quả. Kiểm tra lịch sử buổi học và yêu cầu bổ sung thông tin
          trước khi quyết định.
        </p>
      )}
      {context.attendance &&
        options &&
        !options.obligationsEnded &&
        !options.makeupAlreadyGranted && (
          <ul className="report-makeup-quotas" aria-label="Lượt học bù còn lại">
            {options.makeupQuotas.map((quota) => (
              <li key={quota.userId}>
                <strong>{participantLabel(quota.userId)}:</strong> còn{" "}
                {quota.remaining} lượt
                {quota.reason && (
                  <span className="muted">
                    {" "}
                    · {new StaffApiError(409, quota.reason).message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      {context.attendance && (
        <label className="staff-field">
          <span>
            Phán quyết điểm danh{context.required ? " (bắt buộc)" : ""}
          </span>
          <select
            aria-label="Phán quyết điểm danh"
            required={context.required}
            value={value.noShowRuling ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                noShowRuling: event.target
                  .value as ResolutionDraft["noShowRuling"],
                cancellationMakeupRuling: "",
                makeupUserId: "",
              })
            }
          >
            <option value="">Chọn phán quyết</option>
            {context.allowUphold && (
              <option value="UPHOLD" disabled={unavailable("UPHOLD")}>
                Giữ kết luận vắng học
                {choice("UPHOLD")?.allowed === false
                  ? " (không đủ điều kiện)"
                  : ""}
              </option>
            )}
            <option value="EXCUSE" disabled={unavailable("EXCUSE")}>
              {makeupLabel}
              {blocked ? " (không đủ điều kiện)" : ""}
            </option>
            <option value="COMPLETE" disabled={unavailable("COMPLETE")}>
              Ghi nhận hoàn thành theo bằng chứng
            </option>
          </select>
        </label>
      )}
      {(value.noShowRuling === "COMPLETE" ||
        value.cancellationMakeupRuling === "COMPLETE") && (
        <p className="notice notice-warn">
          Quyết định này ghi nhận buổi học đã hoàn thành và có thể ảnh hưởng
          quyết toán Credit. Không dùng chỉ để đóng báo cáo do hết lượt học bù.
        </p>
      )}
      {value.noShowRuling === "UPHOLD" && (
        <p className="muted">
          Giữ kết luận vắng và áp dụng xử lý theo người vắng. Trường hợp cần học
          bù vẫn phải đáp ứng hạn mức.
        </p>
      )}
      {value.noShowRuling === "EXCUSE" && options?.makeupAlreadyGranted && (
        <p className="muted">
          Chỉ gia hạn thời gian đặt lịch của lượt đã cấp; không cấp thêm lượt.
        </p>
      )}
      {showMakeupUser && (
        <label className="staff-field">
          <span>
            Người sử dụng lượt học bù{!item.reporterId ? " (bắt buộc)" : ""}
          </span>
          <select
            aria-label="Người sử dụng lượt học bù"
            value={value.makeupUserId ?? ""}
            required={!item.reporterId || reporterBlocked}
            onChange={(event) =>
              onChange({ ...value, makeupUserId: event.target.value })
            }
          >
            <option value="" disabled={reporterBlocked}>
              {item.reporterId
                ? "Theo người gửi báo cáo"
                : "Chọn người tham gia"}
            </option>
            {[item.session!.teacherId, item.session!.learnerId].map((id) => (
              <option
                key={id}
                value={id}
                disabled={
                  !!options && !options.eligibleMakeupUserIds.includes(id)
                }
              >
                {participantLabel(id)} · {id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      {context.cancellation && (
        <label className="staff-field">
          <span>
            Quyết định cho buổi đã hủy{context.required ? " (bắt buộc)" : ""}
          </span>
          <select
            aria-label="Quyết định cho buổi đã hủy"
            required={context.required}
            value={value.cancellationMakeupRuling ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                cancellationMakeupRuling: event.target
                  .value as ResolutionDraft["cancellationMakeupRuling"],
                noShowRuling: "",
                makeupUserId: "",
              })
            }
          >
            <option value="">Chọn quyết định</option>
            {(["EXTEND", "COMPLETE"] as const).map((code) => (
              <option
                key={code}
                value={code}
                disabled={
                  options?.cancellationMakeupRulings?.find(
                    (row) => row.value === code,
                  )?.allowed === false
                }
              >
                {code === "EXTEND"
                  ? "Gia hạn đặt lịch của lượt học bù đã cấp"
                  : "Ghi nhận hoàn thành theo bằng chứng"}
              </option>
            ))}
          </select>
          <small>
            Gia hạn không cấp thêm lượt. Chỉ ghi nhận hoàn thành khi có đủ bằng
            chứng.
          </small>
        </label>
      )}
    </section>
  );
}
