"use client";
import Link from "next/link";
import type { ReportCaseDetail } from "@/lib/staff/types";
import type { ResolutionDraft } from "@/lib/staff/report-resolution";
import {
  reportRulingContext,
  reportRulingAvailable,
  cancellationRulingAvailable,
} from "@/lib/staff/report-ruling";
import { StaffApiError } from "@/lib/staff/client";
import { useStaffSession } from "./session";

export function ReportRulingFields({
  item,
  value,
  onChange,
  admin = false,
  scope = "case",
}: Readonly<{
  item: ReportCaseDetail;
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  admin?: boolean;
  scope?: "case" | "incident";
}>) {
  const { portal } = useStaffSession();
  const context = reportRulingContext(item);
  const options = item.resolutionOptions;
  const choice = (code: string) =>
    options?.noShowRulings.find((row) => row.value === code);
  const blocked = choice("EXCUSE")?.blockedReason;
  const unavailable = (code: "UPHOLD" | "EXCUSE" | "COMPLETE") =>
    !reportRulingAvailable(item, code);
  const cancellationBlocked =
    context.cancellation &&
    !(["EXTEND", "COMPLETE"] as const).some((code) =>
      cancellationRulingAvailable(item, code, scope),
    );
  const reporterBlocked =
    !!item.reporterId &&
    !!options &&
    !options.eligibleMakeupUserIds.includes(item.reporterId);
  function excuseLabel() {
    if (options?.obligationsEnded) {
      return "Chấp nhận lý do theo quyết định dừng lộ trình" as const;
    }
    if (context.makeupAlreadyGranted) {
      return "Gia hạn đặt lịch của lượt học bù đã cấp" as const;
    }
    return "Chấp nhận lý do và yêu cầu học bù" as const;
  }
  const makeupLabel = excuseLabel();
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
        <div className="notice notice-warn">
          <div>
            <strong>
              <output>Không thể cấp học bù cho phương án hiện tại.</output>
            </strong>
            <p>{new StaffApiError(409, blocked).message}</p>
            <p>
              Chỉ ghi nhận hoàn thành khi có bằng chứng buổi học đã hoàn thành.
              Nếu chưa đủ căn cứ, quay lại yêu cầu bổ sung thông tin; nếu hai
              bên không thể tiếp tục, xem xét dừng lộ trình.
            </p>
            {admin && portal === "admin" && item.path && (
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
          {scope === "incident"
            ? "API vụ việc chung chưa hỗ trợ quyết định cho buổi đã hủy. Cần bộ phận kỹ thuật bổ sung; không thể xác nhận giải quyết bằng phương án này."
            : "Chưa có dữ liệu xác nhận điều kiện xử lý buổi đã hủy. Cần bộ phận kỹ thuật bổ sung trước khi quyết định."}
        </p>
      )}
      {context.attendance && !options && !context.makeupAlreadyGranted && (
        <p className="notice notice-warn">
          Chưa có dữ liệu hạn mức để cấp học bù. Các phương án cần cấp lượt đang
          tạm khóa. Chỉ ghi nhận hoàn thành nếu bằng chứng xác nhận buổi học đã
          hoàn thành.
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
                completionEvidenceConfirmed: false,
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
        <label className="notice notice-warn row">
          <input
            type="checkbox"
            required
            checked={value.completionEvidenceConfirmed === true}
            onChange={(event) =>
              onChange({
                ...value,
                completionEvidenceConfirmed: event.target.checked,
              })
            }
          />
          <span>
            Tôi đã kiểm tra bằng chứng xác nhận buổi học hoàn thành. Quyết định
            này có thể ảnh hưởng quyết toán Credit.
          </span>
        </label>
      )}
      {value.noShowRuling === "UPHOLD" && (
        <p className="muted">
          Giữ kết luận vắng và áp dụng xử lý theo người vắng. Trường hợp cần học
          bù vẫn phải đáp ứng hạn mức.
        </p>
      )}
      {value.noShowRuling === "EXCUSE" && context.makeupAlreadyGranted && (
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
            disabled={cancellationBlocked}
            value={value.cancellationMakeupRuling ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                cancellationMakeupRuling: event.target
                  .value as ResolutionDraft["cancellationMakeupRuling"],
                noShowRuling: "",
                makeupUserId: "",
                completionEvidenceConfirmed: false,
              })
            }
          >
            <option value="">Chọn quyết định</option>
            {(["EXTEND", "COMPLETE"] as const).map((code) => (
              <option
                key={code}
                value={code}
                disabled={!cancellationRulingAvailable(item, code, scope)}
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
