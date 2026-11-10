"use client";
import { useRef, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Feedback, Panel } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { RecoveryQuiz, type RecoveryQuizData } from "./recovery-quiz";
import styles from "./reputation-recovery.module.css";

type Mission = {
  code: string;
  reward: number;
  claimed: boolean;
  progress: { current: number; target: number; complete: boolean };
};
type Recovery = {
  eligible: boolean;
  missions: Mission[];
  remainingBudget: number;
  quiz: RecoveryQuizData | null;
};
const missions: Record<string, { title: string; description: string }> = {
  POLICY_AWARENESS: {
    title: "Hiểu cách học cùng nhau",
    description: "Trả lời vài câu hỏi ngắn về quy tắc cộng đồng.",
  },
  GOOD_BEHAVIOR_STREAK: {
    title: "Duy trì thói quen tốt",
    description: "Duy trì 14 ngày không có vi phạm mới và có hoạt động hợp lệ.",
  },
  COMMITMENT_RECOVERY: {
    title: "Hoàn thành cam kết học tập",
    description: "Hoàn thành 2 buổi học hợp lệ, có đủ xác nhận của hai bên.",
  },
};
export function ReputationRecovery({
  onChanged,
}: Readonly<{ onChanged: () => void }>) {
  const query = useUserResource<Recovery>("reputation/recovery");
  const { request } = useUserSession();
  const command = useUserCommand(true);
  const [quizOpen, setQuizOpen] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; text: string }>();
  const last = useRef<{ path: string; body: unknown } | undefined>(undefined);
  const locked = command.pending || command.uncertain;
  async function run(path: string, body: unknown) {
    last.current = { path, body };
    setResult(undefined);
    const response = await command.run(JSON.stringify({ path, body }), () =>
      request<{ passed?: boolean; awarded?: number }>(path, {
        method: "POST",
        body,
      }),
    );
    if (!response) return;
    const responseData = response.data;
    const passed = responseData.passed !== false;
    function recoveryResultText() {
      if (!passed) {
        return "Bạn chưa đạt lần này. Đọc lại các câu hỏi và thử lại nhé.";
      }
      if (typeof responseData.awarded === "number") {
        if (responseData.awarded > 0) {
          return `Đã ghi nhận ${responseData.awarded} điểm phục hồi. Tiếp tục duy trì việc học đều đặn nhé!`;
        }
        return "Đã ghi nhận. Bạn đã hết lượt điểm phục hồi trong kỳ này.";
      }
      return "Bạn đã xác nhận chính sách. Trạng thái hạn chế đang được cập nhật.";
    }
    setResult({
      passed,
      text: recoveryResultText(),
    });
    query.reload();
    onChanged();
  }
  const data = query.data;
  const policyMission = data?.missions.find(
    (m) => m.code === "POLICY_AWARENESS",
  );
  return (
    <Panel className={styles.recovery}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}>
            <ProductIcon name="shield" size={22} />
          </span>
          <div>
            <h2>Phục hồi uy tín</h2>
            <p>Những bước nhỏ giúp bạn xây dựng lại sự tin cậy.</p>
          </div>
        </div>
        {data?.eligible && (
          <span className={styles.budget}>
            Còn {data.remainingBudget} điểm <span>trong 30 ngày</span>
          </span>
        )}
      </div>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {data?.eligible ? (
        <>
          <div className={styles.missions}>
            {data.missions.map((mission) => {
              const info = missions[mission.code],
                isQuiz = mission.code === "POLICY_AWARENESS";
              function missionProgressText() {
                if (isQuiz) {
                  return "Bài kiểm tra ngắn";
                }
                if (mission.code === "GOOD_BEHAVIOR_STREAK") {
                  return `${mission.progress.current}/${mission.progress.target} ngày`;
                }
                return `${mission.progress.current}/${mission.progress.target} buổi học`;
              }
              const progressText = missionProgressText();
              function missionIcon() {
                if (mission.claimed) {
                  return "check";
                }
                if (isQuiz) {
                  return "book";
                }
                return "calendar";
              }
              return (
                <article className={styles.mission} key={mission.code}>
                  <div className={styles.missionTop}>
                    <span className={styles.taskIcon}>
                      <ProductIcon name={missionIcon()} size={20} />
                    </span>
                    <span
                      className={mission.claimed ? styles.done : styles.reward}
                    >
                      {mission.claimed
                        ? "Đã nhận điểm"
                        : `+${mission.reward} điểm`}
                    </span>
                  </div>
                  <h3>{info?.title ?? "Nhiệm vụ phục hồi"}</h3>
                  <p>
                    {info?.description ??
                      "Hoàn thành yêu cầu để nhận điểm uy tín."}
                  </p>
                  <div className={styles.missionFoot}>
                    <span className={styles.progressText}>
                      {mission.claimed ? "Đã hoàn thành" : progressText}
                    </span>
                    {!mission.claimed &&
                      (isQuiz ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={
                            locked ||
                            query.loading ||
                            !!query.error ||
                            !data.quiz
                          }
                          aria-expanded={quizOpen}
                          aria-controls="recovery-quiz"
                          onClick={() => setQuizOpen(!quizOpen)}
                        >
                          {quizOpen
                            ? "Thu gọn bài kiểm tra"
                            : "Làm bài kiểm tra"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          disabled={
                            !mission.progress.complete ||
                            locked ||
                            query.loading ||
                            !!query.error
                          }
                          onClick={() =>
                            void run("reputation/recovery/claim", {
                              code: mission.code,
                            })
                          }
                        >
                          {mission.progress.complete
                            ? "Nhận điểm"
                            : "Đang thực hiện"}
                        </button>
                      ))}
                  </div>
                  {!isQuiz && !mission.claimed && (
                    <progress
                      className={styles.progress}
                      value={mission.progress.current}
                      max={Math.max(1, mission.progress.target)}
                      aria-label={`Tiến độ ${info?.title ?? "nhiệm vụ"}`}
                    />
                  )}
                </article>
              );
            })}
          </div>
          {quizOpen && data.quiz && !policyMission?.claimed && (
            <RecoveryQuiz
              key={data.quiz.version}
              quiz={data.quiz}
              disabled={locked || query.loading || !!query.error}
              pending={command.pending}
              onSubmit={(body) => void run("reputation/recovery/quiz", body)}
            />
          )}
        </>
      ) : (
        data && (
          <p className={styles.note}>
            Hiện bạn chưa có nhiệm vụ phục hồi. Tiếp tục tham gia học đúng hẹn
            để duy trì uy tín nhé.
          </p>
        )
      )}
      <div aria-live="polite" aria-atomic="true">
        {result && (
          <p className={result.passed ? styles.success : styles.notice}>
            {result.text}
          </p>
        )}
      </div>
      <CommandFeedback command={command} />
      {command.canRetry && (
        <button
          type="button"
          className="btn"
          disabled={command.pending}
          onClick={() => {
            if (last.current) void run(last.current.path, last.current.body);
          }}
        >
          Kiểm tra lại kết quả
        </button>
      )}
      {data && (
        <details className={styles.policy}>
          <summary>
            <span>Cần mở lại quyền hoạt động?</span>
            <span className={styles.policyHint}>Xem hướng dẫn</span>
          </summary>
          <div className={styles.policyBody}>
            <p>
              Điểm tăng không tự kết thúc hạn chế. Bạn có thể cần chờ hết thời
              hạn, xác nhận chính sách hoặc được nhân sự xét lại.
            </p>
            <ul>
              {(
                data.quiz?.policy ?? [
                  "Tham gia đúng hẹn và chỉ xác nhận những buổi học thực tế.",
                  "Không tạo hoạt động giả; cung cấp thông tin và bằng chứng trung thực.",
                ]
              ).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn"
              disabled={locked || query.loading || !!query.error}
              onClick={() =>
                void run("reputation/restrictions/policy-acknowledgement", {})
              }
            >
              Tôi đã đọc và đồng ý
            </button>
          </div>
        </details>
      )}
    </Panel>
  );
}
