import { formText } from "../components/form-data";
import type { Proposal } from "../types";
export function readProposalHints(fields: FormData) {
  const exchangeTypeHint = formText(fields, "exchangeTypeHint") || null;
  const proposedCredit = formText(fields, "proposedCredit").trim() || null;
  const rawDuration = formText(fields, "proposedDurationMinutes");
  const proposedDurationMinutes = rawDuration ? Number(rawDuration) : null;
  if (
    proposedCredit &&
    (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(proposedCredit) ||
      Number(proposedCredit) <= 0 ||
      !exchangeTypeHint ||
      (exchangeTypeHint === "TWO_WAY" && Number(proposedCredit) < 20))
  )
    throw new Error(
      "Credit gợi ý phải lớn hơn 0, tối đa 2 chữ số thập phân; trao đổi hai chiều cần ít nhất 20 CR mỗi người. Chọn hình thức trước khi nhập Credit.",
    );
  if (
    proposedDurationMinutes !== null &&
    (!Number.isInteger(proposedDurationMinutes) ||
      proposedDurationMinutes < 60 ||
      proposedDurationMinutes > 180)
  )
    throw new Error("Thời lượng gợi ý cần từ 60 đến 180 phút.");
  return {
    exchangeTypeHint,
    proposedCredit,
    proposedDurationMinutes,
    candidateSlots: formText(fields, "candidateSlots").trim() || null,
  };
}
export function ProposalHintsFields({
  disabled,
  initial,
}: Readonly<{ disabled: boolean; initial?: Proposal }>) {
  return (
    <>
      <label>
        <span>Hình thức mong muốn</span>
        <select
          name="exchangeTypeHint"
          defaultValue={initial ? (initial.exchangeTypeHint ?? "") : "ONE_WAY"}
          disabled={disabled}
        >
          <option value="ONE_WAY">Hướng dẫn một chiều</option>
          <option value="TWO_WAY">Trao đổi kỹ năng hai chiều</option>
          <option value="">Trao đổi thêm sau khi kết nối</option>
        </select>
      </label>
      <label>
        <span>Credit gợi ý (không bắt buộc)</span>
        <input
          name="proposedCredit"
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          defaultValue={initial?.proposedCredit ?? ""}
          disabled={disabled}
        />
        <small>
          Một chiều: tổng Credit. Hai chiều: mỗi người, tối thiểu 20 CR.
        </small>
      </label>
      <label>
        <span>Thời lượng mỗi buổi gợi ý (phút, không bắt buộc)</span>
        <input
          name="proposedDurationMinutes"
          type="number"
          min={60}
          max={180}
          step={1}
          defaultValue={initial?.proposedDurationMinutes ?? ""}
          disabled={disabled}
        />
      </label>
      <label>
        <span>Gợi ý thời gian (không bắt buộc)</span>
        <textarea
          name="candidateSlots"
          rows={2}
          maxLength={1000}
          defaultValue={initial?.candidateSlots ?? ""}
          disabled={disabled}
          placeholder="Ví dụ: Tối thứ Ba và thứ Năm"
        />
      </label>
      <p className="muted">Gợi ý sẽ được hai bên xác nhận lại.</p>
    </>
  );
}
