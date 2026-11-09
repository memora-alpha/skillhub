"use client";
import { useRef, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Feedback, Panel } from "../components/common";
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
  quiz: { version: string; policy: string[]; questions: string[] } | null;
};
const names: Record<string, string> = {
  POLICY_AWARENESS: "Hiểu chính sách",
  GOOD_BEHAVIOR_STREAK: "Duy trì hành vi tốt",
  COMMITMENT_RECOVERY: "Hoàn thành cam kết học tập",
};
export function ReputationRecovery({
  onChanged,
}: Readonly<{ onChanged: () => void }>) {
  const query = useUserResource<Recovery>("reputation/recovery"),
    { request } = useUserSession(),
    command = useUserCommand(true);
  const [result, setResult] = useState<string>(),
    form = useRef<HTMLFormElement>(null),
    last = useRef<{ path: string; body: unknown } | undefined>(undefined);
  async function run(path: string, body: unknown) {
    last.current = { path, body };
    const response = await command.run(JSON.stringify({ path, body }), () =>
      request<{ passed?: boolean; awarded?: number }>(path, {
        method: "POST",
        body,
      }),
    );
    if (response) {
      setResult(
        response.data.passed === false
          ? "Chưa đạt. Bạn hãy đọc lại và thử lại."
          : `Đã ghi nhận${typeof response.data.awarded === "number" ? ": +" + response.data.awarded + " điểm" : ""}.`,
      );
      query.reload();
      onChanged();
    }
  }
  return (
    <Panel title="Phục hồi uy tín">
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.data && (
        <>
          {!query.data.eligible ? (
            <p>Hiện không có nhiệm vụ phục hồi dành cho bạn.</p>
          ) : (
            <>
              <p>
                Còn tối đa {query.data.remainingBudget} điểm phục hồi trong kỳ.
              </p>
              {query.data.missions.map((mission) => (
                <div key={mission.code}>
                  <h3>{names[mission.code] ?? mission.code}</h3>
                  <p>
                    {mission.claimed
                      ? "Đã nhận điểm"
                      : `${mission.progress.current}/${mission.progress.target} · +${mission.reward} điểm`}
                  </p>
                  {mission.code !== "POLICY_AWARENESS" && !mission.claimed && (
                    <button
                      className="btn"
                      disabled={
                        !mission.progress.complete ||
                        query.loading ||
                        command.pending ||
                        command.uncertain
                      }
                      onClick={() =>
                        void run("reputation/recovery/claim", {
                          code: mission.code,
                        })
                      }
                    >
                      Nhận điểm
                    </button>
                  )}
                </div>
              ))}
              {query.data.quiz &&
                !query.data.missions.find(
                  (row) => row.code === "POLICY_AWARENESS",
                )?.claimed && (
                  <details>
                    <summary>Làm bài kiểm tra chính sách</summary>
                    <form
                      ref={form}
                      className="learner-form"
                      key={query.data.quiz.version}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void run("reputation/recovery/quiz", {
                          version: query.data!.quiz!.version,
                          answers: query.data!.quiz!.questions.map(
                            (_, i) => data.get("answer" + i) === "true",
                          ),
                        });
                      }}
                    >
                      {query.data.quiz.questions.map((question, i) => (
                        <fieldset key={question}>
                          <legend>{question}</legend>
                          {[
                            ["true", "Đúng"],
                            ["false", "Sai"],
                          ].map(([value, label]) => (
                            <label key={value}>
                              <input
                                required
                                type="radio"
                                name={"answer" + i}
                                value={value}
                                disabled={command.pending || command.uncertain}
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                      ))}
                      <button
                        className="btn btn-primary"
                        disabled={command.pending || command.uncertain}
                      >
                        Nộp bài
                      </button>
                    </form>
                  </details>
                )}
            </>
          )}
          <details>
            <summary>Xác nhận chính sách để mở lại quyền</summary>
            <p>
              Điểm phục hồi không tự gỡ hạn chế. Một số hạn chế cần hết thời hạn
              và được xác nhận chính sách hoặc nhân sự xét lại.
            </p>
            <p>
              Tham gia đúng hẹn, chỉ xác nhận buổi học thực tế, không tạo hoạt
              động giả và cung cấp bằng chứng trung thực.
            </p>
            <button
              className="btn"
              disabled={command.pending || command.uncertain}
              onClick={() =>
                void run("reputation/restrictions/policy-acknowledgement", {})
              }
            >
              Tôi đã đọc và xác nhận
            </button>
          </details>
        </>
      )}
      <CommandFeedback command={command} />
      {command.canRetry && (
        <button
          className="btn"
          disabled={command.pending}
          onClick={() => {
            if (last.current) void run(last.current.path, last.current.body);
          }}
        >
          Kiểm tra lại yêu cầu
        </button>
      )}
      {result && <p role="status">{result}</p>}
    </Panel>
  );
}
