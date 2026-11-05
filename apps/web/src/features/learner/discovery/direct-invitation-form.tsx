"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Feedback } from "../components/common";
import { formText } from "../components/form-data";
import type { PublicSharingSkill } from "./discovery-types";
import { sendDirectInvitation, type InvitationBody } from "./direct-invitation";
import {
  ProposalHintsFields,
  readProposalHints,
} from "../connections/proposal-hints";

export function DirectInvitationForm({
  skill,
  recipientId,
  fullName,
}: Readonly<{
  skill: PublicSharingSkill;
  recipientId: string;
  fullName: string;
}>) {
  const { request } = useUserSession();
  const command = useUserCommand(true);
  const router = useRouter();
  const [validation, setValidation] = useState<string>();
  const submitted = useRef<InvitationBody | undefined>(undefined);
  const disabled = command.pending || (command.uncertain && !command.canRetry);
  const sendLabel = command.canRetry
    ? "Kiểm tra và thử lại lời mời"
    : "Gửi lời mời trực tiếp";
  return (
    <form
      className="learner-form"
      aria-busy={command.pending}
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        let hints: ReturnType<typeof readProposalHints>;
        try {
          hints = readProposalHints(fields);
        } catch (cause) {
          setValidation(
            cause instanceof Error ? cause.message : "Gợi ý chưa hợp lệ.",
          );
          return;
        }
        const body =
          command.canRetry && submitted.current
            ? submitted.current
            : {
                sourceType: "DIRECT_SEARCH" as const,
                recipientSharingSkillId: skill.id,
                message: formText(fields, "message").trim(),
                ...hints,
              };
        if (Array.from(body.message).length < 10) {
          setValidation(
            "Lời nhắn cần ít nhất 10 ký tự, không tính khoảng trắng ở đầu và cuối.",
          );
          return;
        }
        setValidation(undefined);
        const result = await command.run(JSON.stringify(body), (key) => {
          submitted.current = body;
          return sendDirectInvitation(
            request,
            { recipientId, skillId: skill.skill.id },
            body,
            key,
          );
        });
        if (result) router.push("/learn/connections/" + result.id);
      }}
    >
      <p>
        Lời mời trực tiếp đến <strong>{fullName}</strong> · {skill.skill.name}.
      </p>
      <p className="muted">
        Bạn là người muốn học kỹ năng này. Lời mời chưa giữ hay trừ Credit; lịch
        và Credit sẽ được thống nhất trong thỏa thuận sau khi kết nối.
      </p>
      <fieldset disabled={command.pending || command.uncertain}>
        <label>
          <span>Lời nhắn và mục tiêu học</span>
          <textarea
            name="message"
            rows={4}
            minLength={10}
            maxLength={1000}
            required
            placeholder="Giới thiệu nhu cầu học và điều bạn mong muốn được hướng dẫn…"
          />
        </label>
        <ProposalHintsFields disabled={command.pending || command.uncertain} />
      </fieldset>
      <Feedback error={validation} />
      <CommandFeedback command={command} />
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {command.pending ? "Đang gửi lời mời…" : sendLabel}
      </button>
    </form>
  );
}
