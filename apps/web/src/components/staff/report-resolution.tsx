"use client";
import {
  violationLabels,
  type ResolutionDraft,
  type ViolationCode,
} from "@/lib/staff/report-resolution";
export function ReportResolutionFields({
  value,
  admin,
  onChange,
  sessionCase = false,
  attendanceManaged = false,
  rulingRequired = false,
  allowUphold = false,
  cancelledMakeup = false,
  unverifiable = false,
  systemCase = false,
}: Readonly<{
  value: ResolutionDraft;
  admin: boolean;
  onChange: (value: ResolutionDraft) => void;
  sessionCase?: boolean;
  attendanceManaged?: boolean;
  rulingRequired?: boolean;
  allowUphold?: boolean;
  cancelledMakeup?: boolean;
  unverifiable?: boolean;
  systemCase?: boolean;
}>) {
  return (
    <div className="stack">
      {attendanceManaged && (
        <label className="staff-field">
          <span>Phán quyết điểm danh{rulingRequired ? " (bắt buộc)" : ""}</span>
          <select
            required={rulingRequired}
            value={value.noShowRuling ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                noShowRuling: e.target.value as ResolutionDraft["noShowRuling"],
                makeupUserId: "",
              })
            }
          >
            <option value="">Chọn phán quyết</option>
            {allowUphold && (
              <option value="UPHOLD">Giữ kết luận vắng học</option>
            )}
            <option value="EXCUSE">Chấp nhận lý do và yêu cầu học bù</option>
            <option value="COMPLETE">Ghi nhận hoàn thành buổi học</option>
          </select>
        </label>
      )}
      {unverifiable && value.noShowRuling === "EXCUSE" && (
        <label className="staff-field">
          <span>
            Người yêu cầu sử dụng lượt học bù
            {systemCase ? " (bắt buộc cho vụ việc hệ thống)" : ""}
          </span>
          <select
            value={value.makeupUserId ?? ""}
            required={systemCase}
            onChange={(e) =>
              onChange({ ...value, makeupUserId: e.target.value })
            }
          >
            <option value="">
              {systemCase ? "Chọn người yêu cầu" : "Theo người gửi báo cáo"}
            </option>
            {value.participants.map((p, i) => (
              <option key={p.userId} value={p.userId}>
                Người tham gia {i + 1} — {p.userId}
              </option>
            ))}
          </select>
        </label>
      )}
      {cancelledMakeup && (
        <label className="staff-field">
          <span>Quyết định cho học bù từ hủy buổi</span>
          <select
            required={rulingRequired}
            value={value.cancellationMakeupRuling ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                cancellationMakeupRuling: e.target
                  .value as ResolutionDraft["cancellationMakeupRuling"],
              })
            }
          >
            <option value="">Chọn quyết định</option>
            <option value="EXTEND">
              Gia hạn đặt lịch của lượt học bù đã cấp
            </option>
            <option value="COMPLETE">
              Ghi nhận hoàn thành theo kết luận xử lý
            </option>
          </select>
          <small>Gia hạn không cấp thêm một lượt học bù.</small>
        </label>
      )}
      <p className="muted">
        Chọn biện pháp xử lý nếu cần. Mỗi thay đổi sẽ được ghi nhận cùng lý do
        giải quyết vụ việc.
      </p>
      {value.participants.map((p, index) => {
        const update = (patch: Partial<typeof p>) =>
          onChange({
            ...value,
            participants: value.participants.map((row, i) =>
              i === index ? { ...row, ...patch } : row,
            ),
          });
        return (
          <section className="stack" key={p.userId}>
            <h3 className="sub-title">Người tham gia {index + 1}</h3>
            <p className="mono">{p.userId}</p>
            <label className="staff-field">
              <span>Vi phạm uy tín</span>
              <select
                value={p.violation}
                onChange={(e) =>
                  update({ violation: e.target.value as ViolationCode | "" })
                }
              >
                <option value="">Không ghi nhận vi phạm</option>
                {Object.entries(violationLabels)
                  .filter(([code]) => !sessionCase || code !== "NO_SHOW")
                  .map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {p.violation === "FRAUD" && (
              <label className="staff-field">
                <span>Mức trừ điểm gian lận (-30 đến -20)</span>
                <input
                  type="number"
                  required
                  min={-30}
                  max={-20}
                  step={1}
                  value={p.delta}
                  onChange={(e) => update({ delta: e.target.value })}
                />
              </label>
            )}
            {admin && (
              <label className="staff-field">
                <span>Điều chỉnh Credit (không bắt buộc; số âm để trừ)</span>
                <input
                  inputMode="decimal"
                  pattern="-?(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?"
                  placeholder="Ví dụ: -5.00"
                  value={p.amount}
                  onChange={(e) => update({ amount: e.target.value })}
                />
              </label>
            )}
          </section>
        );
      })}
      {admin && (
        <>
          <label className="staff-field">
            <span>Hạn chế tạo hoạt động mới</span>
            <select
              value={value.restrictedUserId}
              onChange={(e) =>
                onChange({ ...value, restrictedUserId: e.target.value })
              }
            >
              <option value="">Không áp dụng hạn chế bổ sung</option>
              {value.participants.map((p, i) => (
                <option key={p.userId} value={p.userId}>
                  Người tham gia {i + 1} — {p.userId}
                </option>
              ))}
            </select>
          </label>
          {value.restrictedUserId && (
            <label className="staff-field">
              <span>Thời hạn</span>
              <select
                value={value.days}
                onChange={(e) => onChange({ ...value, days: e.target.value })}
              >
                {[1, 3, 7, 30].map((days) => (
                  <option key={days} value={days}>
                    {days} ngày
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="staff-field">
            <span>Đảo giao dịch của lộ trình (không bắt buộc)</span>
            <textarea
              rows={3}
              placeholder="Mỗi dòng một mã giao dịch UUID; tối đa 5 mã."
              value={value.reversals}
              onChange={(e) =>
                onChange({ ...value, reversals: e.target.value })
              }
            />
          </label>
        </>
      )}
    </div>
  );
}
