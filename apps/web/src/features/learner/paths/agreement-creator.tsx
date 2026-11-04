"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, Proposal, LearningPath } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Panel } from "../components/common";
export function AgreementCreator({
  conversation,
  proposal,
  path,
}: Readonly<{
  conversation: Conversation;
  proposal?: Proposal;
  path?: LearningPath;
}>) {
  const { actor, request } = useUserSession(),
    command = useUserCommand(),
    router = useRouter();
  const [exchangeType, setExchangeType] = useState(
    path?.agreement.exchangeType ?? "ONE_WAY",
  );
  const counterpart =
    actor.userId === conversation.participantAId
      ? conversation.participantBId
      : conversation.participantAId;
  const proposedTeacher =
    proposal?.sourceType === "LEARNING_REQUEST"
      ? proposal.proposerId
      : proposal?.recipientId;
  const teacherId =
    path?.agreement.teacherId ?? proposedTeacher ?? actor.userId;
  const learnerId = teacherId === actor.userId ? counterpart : actor.userId;
  const oneWayRole =
    teacherId === actor.userId
      ? "Bạn hướng dẫn, đối tác học."
      : "Đối tác hướng dẫn, bạn học.";
  const roleDescription =
    exchangeType === "ONE_WAY"
      ? oneWayRole
      : "Mỗi người tạo và giảng dạy kế hoạch riêng; cả hai cùng xác nhận lịch.";
  return (
    <Panel title={path ? "Điều chỉnh thỏa thuận" : "Thỏa thuận học tập"}>
      <form
        className="learner-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const terms =
            exchangeType === "ONE_WAY"
              ? {
                  exchangeType,
                  teacherId,
                  learnerId,
                  negotiatedCredit: formText(values, "credit"),
                }
              : {
                  exchangeType,
                  totalCreditPerUser: formText(values, "credit"),
                };
          const body = path
            ? { ...terms, expectedVersion: path.currentVersion }
            : { ...terms, conversationId: conversation.id };
          const result = await command.run(JSON.stringify(body), () =>
            request<{ id: string }>(
              "learning-paths" + (path ? "/" + path.id : ""),
              { method: path ? "PATCH" : "POST", body },
            ),
          );
          if (result) router.push("/learn/paths/" + result.data.id);
        }}
      >
        <label>
          <span>Hình thức học</span>
          <select
            value={exchangeType}
            onChange={(event) =>
              setExchangeType(event.target.value as "ONE_WAY" | "TWO_WAY")
            }
            disabled={command.pending || command.uncertain}
          >
            <option value="ONE_WAY">Một chiều · một người hướng dẫn</option>
            <option value="TWO_WAY">Hai chiều · cùng trao đổi kỹ năng</option>
          </select>
        </label>
        <p>{roleDescription}</p>
        <label>
          <span>
            {exchangeType === "ONE_WAY"
              ? "Credit cho cả lộ trình"
              : "Credit mỗi người tạm giữ"}
          </span>
          <input
            name="credit"
            type="number"
            min={exchangeType === "TWO_WAY" ? 20 : 0.01}
            step="0.01"
            max="9999999999.99"
            defaultValue={
              path?.agreement.negotiatedCredit ??
              path?.agreement.totalCreditPerUser ??
              "20"
            }
            required
            disabled={command.pending || command.uncertain}
          />
        </label>
        <p className="muted">
          Tạo thỏa thuận chưa giữ Credit. Hai bên tiếp tục xác nhận điều khoản,
          kế hoạch và lịch trước khi chốt.
        </p>
        <CommandFeedback command={command} />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={command.pending || command.uncertain}
        >
          {path ? "Lưu điều chỉnh" : "Tạo thỏa thuận để cùng xác nhận"}
        </button>
      </form>
    </Panel>
  );
}
