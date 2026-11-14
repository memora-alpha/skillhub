import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
  useConnectionCommand,
} from "@/features/connections";
import { createRecoveryApi, type RecoveryResult } from "../api/recovery-api";
import { RecoveryQuiz } from "./recovery-quiz";
import { reputationStyles as styles } from "./reputation.styles";

const labels: Record<string, string> = {
  POLICY_AWARENESS: "Hiểu nguyên tắc cộng đồng",
  GOOD_BEHAVIOR_STREAK: "Duy trì hoạt động tích cực",
  COMMITMENT_RECOVERY: "Hoàn thành cam kết học tập",
};
export function RecoveryPanel() {
  const runtime = useConnections();
  return <RecoveryContent key={runtime.key.join(":")} />;
}
function RecoveryContent() {
  const runtime = useConnections();
  const api = useMemo(() => createRecoveryApi(runtime.call), [runtime]);
  const query = useConnectionQuery(["reputation", "recovery"], api.read, true, {
    refreshOnFocus: "stale",
  });
  const command = useConnectionCommand<RecoveryResult>([["reputation"]]);
  const [draft, setDraft] = useState<{
    version?: string;
    answers: Record<number, boolean>;
  }>({ answers: {} });
  const answers =
    draft.version === query.data?.quiz?.version ? draft.answers : {};
  const [notice, setNotice] = useState<RecoveryResult>();
  const [quizOpen, setQuizOpen] = useState(false);
  const locked =
    command.pending || command.uncertain || query.isFetching || !!query.error;
  function observed(result: RecoveryResult | undefined) {
    if (!result || !runtime.isCurrent()) return;
    setNotice(result);
    if (result.passed) setQuizOpen(false);
    void query.refetch({ cancelRefetch: false });
  }
  async function submit(code: string) {
    const quiz = query.data?.quiz;
    const result = await command.run(
      JSON.stringify([code, quiz?.version, answers]),
      () =>
        code === "POLICY_AWARENESS" && quiz
          ? api.quiz(
              quiz.version,
              quiz.questions.map((_, index) => answers[index]!),
            )
          : api.claim(code),
    );
    observed(result);
  }
  if (!query.data?.eligible)
    return (
      <ConnectionFeedback
        error={query.error}
        retry={query.refetch}
        loadingPresentation="silent"
      />
    );
  const data = query.data;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.heading}>
          Phục hồi uy tín
        </Text>
        <Text style={styles.reward}>Còn {data.remainingBudget} điểm</Text>
      </View>
      <ConnectionFeedback
        error={query.error ?? command.error}
        retry={query.refetch}
      />
      {data.missions.map((item, index) => (
        <View
          key={item.code}
          style={[styles.section, index > 0 && styles.separator]}
        >
          <View style={styles.row}>
            <Text style={styles.label}>{labels[item.code]}</Text>
            <Text style={styles.reward}>
              {item.claimed
                ? "Đã nhận điểm"
                : `+${Math.min(item.reward, data.remainingBudget)} điểm`}
            </Text>
          </View>
          {!item.claimed && (
            <Text style={styles.meta}>
              {item.code === "POLICY_AWARENESS"
                ? `${data.quiz?.questions.length ?? 0} câu hỏi về nguyên tắc cộng đồng`
                : `${item.progress.current}/${item.progress.target} ${item.code === "GOOD_BEHAVIOR_STREAK" ? "ngày" : "buổi học"}`}
            </Text>
          )}
          {!item.claimed &&
            (item.code === "POLICY_AWARENESS" ? (
              <Button
                variant="paper"
                disabled={locked || !data.quiz || data.remainingBudget === 0}
                onPress={() => {
                  setQuizOpen(!quizOpen);
                  setNotice(undefined);
                }}
              >
                {quizOpen ? "Thu gọn câu hỏi" : "Làm bài kiểm tra"}
              </Button>
            ) : (
              <Button
                variant="craft"
                disabled={
                  locked ||
                  !item.progress.complete ||
                  data.remainingBudget === 0
                }
                onPress={() => void submit(item.code)}
              >
                Nhận điểm
              </Button>
            ))}
        </View>
      ))}
      {data.remainingBudget === 0 && (
        <Text style={styles.meta}>
          Bạn đã nhận đủ điểm phục hồi trong 30 ngày gần nhất.
        </Text>
      )}
      {quizOpen && data.quiz && (
        <RecoveryQuiz
          key={data.quiz.version}
          quiz={data.quiz}
          answers={answers}
          disabled={locked || data.remainingBudget === 0}
          onAnswer={(index, answer) =>
            setDraft({
              version: data.quiz!.version,
              answers: { ...answers, [index]: answer },
            })
          }
          onSubmit={() => void submit("POLICY_AWARENESS")}
        />
      )}
      {notice && (
        <FormNotice compact tone={notice.passed ? "success" : "info"}>
          {notice.passed
            ? notice.awarded > 0
              ? `Đã ghi nhận ${notice.awarded} điểm phục hồi.`
              : "Nhiệm vụ đã được ghi nhận, không có điểm mới được cộng."
            : "Chưa đạt. Hãy xem lại nguyên tắc và thử lần nữa."}
        </FormNotice>
      )}
      {command.uncertain && (
        <>
          <FormNotice compact tone="warning">
            Chưa rõ kết quả. Kiểm tra lại trước khi thực hiện nhiệm vụ khác.
          </FormNotice>
          <Button
            variant="paper"
            disabled={command.pending}
            onPress={() => void command.retry().then(observed)}
          >
            Kiểm tra kết quả
          </Button>
        </>
      )}
    </View>
  );
}
