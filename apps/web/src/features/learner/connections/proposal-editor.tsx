"use client";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Feedback } from "../components/common";
import { formText } from "../components/form-data";
import { ProposalHintsFields, readProposalHints } from "./proposal-hints";
import type { Proposal } from "../types";

export function ProposalEditor({
  proposal,
  onClose,
}: Readonly<{ proposal: Proposal; onClose: () => void }>) {
  const { request } = useUserSession();
  const command = useUserCommand(true);
  const [reviewed, setReviewed] = useState(proposal);
  const [error, setError] = useState<string>();
  const stale =
    proposal.version !== reviewed.version || proposal.status !== "PENDING";
  const disabled = stale || command.pending || command.uncertain;
  const [sent, setSent] = useState<Record<string, unknown>>();
  async function send(body: Record<string, unknown>) {
    setSent(body);
    const result = await command.run(JSON.stringify(body), (key) =>
      request<Proposal>("proposals/" + proposal.id, {
        method: "PATCH",
        key,
        body,
      }),
    );
    if (result) onClose();
  }
  return (
    <form
      className="learner-form"
      key={reviewed.id + ":" + reviewed.version}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        setError(undefined);
        try {
          const fields = new FormData(event.currentTarget);
          void send({
            expectedVersion: reviewed.version,
            message: formText(fields, "message").trim(),
            ...readProposalHints(fields),
          });
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Kiểm tra lại nội dung.",
          );
        }
      }}
    >
      <h3>Sửa đề xuất đang chờ</h3>
      <p className="muted">
        Chỉ sửa nội dung và gợi ý. Người nhận, bài nguồn và hạn xử lý do máy chủ
        quản lý.
      </p>
      {stale && (
        <p className="learner-notice">
          Đề xuất đã thay đổi hoặc được xử lý. Nội dung đang nhập được giữ lại;
          không gửi đè phiên bản cũ.
        </p>
      )}
      <label>
        <span>Lời nhắn</span>
        <textarea
          name="message"
          rows={4}
          minLength={10}
          maxLength={1000}
          required
          defaultValue={reviewed.message}
          disabled={disabled}
        />
      </label>
      <ProposalHintsFields initial={reviewed} disabled={disabled} />
      <Feedback error={error} />
      <CommandFeedback command={command} />
      <div className="learner-actions">
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          Lưu đề xuất
        </button>
        {command.canRetry && sent && (
          <button
            type="button"
            className="btn"
            disabled={command.pending}
            onClick={() => void send(sent)}
          >
            Thử lại cùng yêu cầu
          </button>
        )}
        {stale && proposal.status === "PENDING" && !command.uncertain && (
          <button
            type="button"
            className="btn"
            onClick={() => setReviewed(proposal)}
          >
            Thay bản nhập bằng phiên bản mới
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={command.pending || command.uncertain}
          onClick={onClose}
        >
          Đóng chỉnh sửa
        </button>
      </div>
    </form>
  );
}
