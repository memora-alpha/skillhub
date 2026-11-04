"use client";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Panel, formatTime } from "../components/common";
import type { LearningPath } from "../types";
import {
  allSessionsCompleted,
  settlementReceipt,
  type SettlementReceipt,
} from "./settlement-policy";

export function SettlementPanel({
  path,
  blocked,
}: Readonly<{
  path: LearningPath;
  blocked: boolean;
}>) {
  const { actor, request } = useUserSession();
  const command = useUserCommand(true);
  const [receipt, setReceipt] = useState<SettlementReceipt>();
  const completed = allSessionsCompleted(path);
  const settled = !!path.settledAt || !!receipt;
  const allowed =
    !!path.lockedVersion &&
    ["ACTIVE", "COMPLETED"].includes(path.status) &&
    (settled || completed);
  const ownOutcome = settlementOutcome(path, actor.userId);
  async function check() {
    const result = await command.run("settlement:" + path.id, async () => {
      const value = await request<unknown>(
        "sessions/paths/" + path.id + "/settlement",
        { method: "POST" },
      );
      return settlementReceipt(value.data, path.id);
    });
    if (result) setReceipt(result);
  }
  let settlementNotice: string;
  if (settled) settlementNotice = "Đã quyết toán theo kết quả máy chủ.";
  else if (completed)
    settlementNotice =
      "Các buổi đã hoàn tất. Chờ hệ thống kiểm tra điều kiện quyết toán.";
  else
    settlementNotice =
      "Credit tiếp tục được giữ đến khi lộ trình đủ điều kiện.";
  let settlementButton: string;
  if (command.pending) settlementButton = "Đang kiểm tra…";
  else if (settled) settlementButton = "Xem kết quả quyết toán";
  else settlementButton = "Kiểm tra / yêu cầu quyết toán";
  return (
    <Panel title="Hoàn Credit & quyết toán lộ trình">
      <p>{ownOutcome}</p>
      <p>
        Chỉ quyết toán khi tất cả buổi hoàn tất, đã hết hạn khiếu nại và không
        còn tranh chấp giữ Credit. Hệ thống tự kiểm tra; bạn cũng có thể yêu cầu
        kiểm tra kết quả.
      </p>
      <p>
        <output>{settlementNotice}</output>
      </p>
      {path.settledAt && <p>Thời điểm: {formatTime(path.settledAt)}</p>}
      {receipt && (
        <dl>
          <dt>Tổng Credit cả thỏa thuận</dt>
          <dd>{receipt.gross ?? "Chưa có dữ liệu"}</dd>
          <dt>Phí cả thỏa thuận</dt>
          <dd>{receipt.fee ?? "Chưa có dữ liệu"}</dd>
          <dt>Mã quyết toán</dt>
          <dd className="learner-prose">
            {receipt.operationId ?? "Chưa có dữ liệu"}
          </dd>
        </dl>
      )}
      <CommandFeedback command={command} />
      <div className="learner-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            !allowed ||
            blocked ||
            command.pending ||
            (command.uncertain && !command.canRetry)
          }
          onClick={() => void check()}
        >
          {settlementButton}
        </button>
        <Link className="btn" href="/learn/wallet">
          Xem ví & lịch sử Credit
        </Link>
      </div>
    </Panel>
  );
}

function settlementOutcome(path: LearningPath, userId: string) {
  if (path.agreement.exchangeType === "TWO_WAY")
    return "Mỗi người được hoàn 96% Credit đã giữ của chính mình; 4% là phí nền tảng.";
  if (path.agreement.teacherId === userId)
    return "Bạn là người dạy: nhận 96% Credit thỏa thuận; 4% là phí nền tảng.";
  return "Học một chiều: 96% Credit đã giữ được trả cho người dạy; 4% là phí nền tảng.";
}
