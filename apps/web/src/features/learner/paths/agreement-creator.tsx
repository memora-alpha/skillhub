"use client";
import { LoadingButton } from "@/components/loading-button";
import { formText } from "../components/form-data";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, Proposal, LearningPath } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Panel } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { AgreementSummary } from "./agreement-summary";
import styles from "./path-detail.module.css";

export function AgreementCreator({
  conversation,
  proposal,
  path,
  onSaved,
}: Readonly<{
  conversation: Conversation;
  proposal?: Proposal;
  path?: LearningPath;
  onSaved?: () => void;
}>) {
  const { actor, request } = useUserSession();
  const command = useUserCommand();
  const router = useRouter();
  const [exchangeType, setExchangeType] = useState<"ONE_WAY" | "TWO_WAY">(
    path?.agreement.exchangeType ??
      (proposal?.exchangeTypeHint === "TWO_WAY" ? "TWO_WAY" : "ONE_WAY"),
  );
  const [credit, setCredit] = useState(
    path?.agreement.negotiatedCredit ??
      path?.agreement.totalCreditPerUser ??
      "20",
  );
  const counterpart =
    actor.userId === conversation.participantAId
      ? conversation.participantBId
      : conversation.participantAId;
  const proposedTeacher =
    proposal?.sourceType === "LEARNING_REQUEST"
      ? proposal.proposerId
      : proposal?.recipientId;
  const [teacherId, setTeacherId] = useState(
    path?.agreement.teacherId ?? proposedTeacher ?? actor.userId,
  );
  const learnerId = teacherId === actor.userId ? counterpart : actor.userId;
  const disabled = command.pending || command.uncertain;

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
          if (result) {
            onSaved?.();
            router.push("/learn/paths/" + result.data.id);
          }
        }}
      >
        <fieldset className={styles.choiceGroup} disabled={disabled}>
          <legend>Hình thức học</legend>
          <div className={styles.choiceCards}>
            <button
              type="button"
              className={
                styles.choiceCard +
                (exchangeType === "ONE_WAY"
                  ? ` ${styles.choiceCardActive}`
                  : "")
              }
              aria-pressed={exchangeType === "ONE_WAY"}
              onClick={() => setExchangeType("ONE_WAY")}
            >
              <span className={styles.choiceCardIcon}>
                <ProductIcon name="user" size={17} />
              </span>
              <span className={styles.choiceCardText}>
                <strong>Một chiều</strong>
                <small>Một người hướng dẫn, một người học theo kế hoạch.</small>
              </span>
            </button>

            <button
              type="button"
              className={
                styles.choiceCard +
                (exchangeType === "TWO_WAY"
                  ? ` ${styles.choiceCardActive}`
                  : "")
              }
              aria-pressed={exchangeType === "TWO_WAY"}
              onClick={() => setExchangeType("TWO_WAY")}
            >
              <span className={styles.choiceCardIcon}>
                <ProductIcon name="users" size={17} />
              </span>
              <span className={styles.choiceCardText}>
                <strong>Hai chiều</strong>
                <small>
                  Cả hai cùng trao đổi kỹ năng và tạo kế hoạch riêng.
                </small>
              </span>
            </button>
          </div>
        </fieldset>

        {exchangeType === "ONE_WAY" && (
          <fieldset className={styles.choiceGroup} disabled={disabled}>
            <legend>Vai trò trong lộ trình một chiều</legend>
            <div className={styles.choiceCards}>
              <button
                type="button"
                className={
                  styles.choiceCard +
                  (teacherId === actor.userId
                    ? ` ${styles.choiceCardActive}`
                    : "")
                }
                aria-pressed={teacherId === actor.userId}
                onClick={() => setTeacherId(actor.userId)}
              >
                <span className={styles.choiceCardIcon}>
                  <ProductIcon name="book" size={17} />
                </span>
                <span className={styles.choiceCardText}>
                  <strong>Bạn hướng dẫn</strong>
                  <small>
                    Bạn tạo kế hoạch giảng dạy, đối tác là người học.
                  </small>
                </span>
              </button>

              <button
                type="button"
                className={
                  styles.choiceCard +
                  (teacherId === counterpart
                    ? ` ${styles.choiceCardActive}`
                    : "")
                }
                aria-pressed={teacherId === counterpart}
                onClick={() => setTeacherId(counterpart)}
              >
                <span className={styles.choiceCardIcon}>
                  <ProductIcon name="award" size={17} />
                </span>
                <span className={styles.choiceCardText}>
                  <strong>Bạn học</strong>
                  <small>Đối tác hướng dẫn và lập kế hoạch học cho bạn.</small>
                </span>
              </button>
            </div>
          </fieldset>
        )}

        <label>
          <span>
            {exchangeType === "ONE_WAY"
              ? "Credit cho cả lộ trình"
              : "Credit mỗi người tạm giữ (tối thiểu 20 CR)"}
          </span>
          <div className={styles.creditFieldWrap}>
            <input
              name="credit"
              type="number"
              min={exchangeType === "TWO_WAY" ? 20 : 0.01}
              step="0.01"
              max="9999999999.99"
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
              required
              disabled={disabled}
            />
            <span className={styles.creditUnit}>
              {exchangeType === "TWO_WAY" ? "CR / người" : "CR"}
            </span>
          </div>
          <small>
            Tạo thỏa thuận chưa giữ Credit. Hai bên tiếp tục xác nhận điều
            khoản, kế hoạch và lịch trước khi chốt.
          </small>
        </label>

        <AgreementSummary
          exchangeType={exchangeType}
          teacherId={teacherId}
          learnerId={learnerId}
          amount={credit}
          counterpartId={counterpart}
        />

        <CommandFeedback command={command} />

        <div className={styles.actionRow}>
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={disabled}
            loading={!!command.pending}
          >
            {path
              ? "Lưu điều chỉnh thỏa thuận"
              : "Tạo thỏa thuận để cùng xác nhận"}
          </LoadingButton>
        </div>
      </form>
    </Panel>
  );
}
