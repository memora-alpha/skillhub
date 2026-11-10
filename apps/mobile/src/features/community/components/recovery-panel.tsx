import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
  useConnectionCommand,
} from "@/features/connections";
import { parse } from "@/lib/http/contracts";
const recovery = z.object({
  eligible: z.boolean(),
  remainingBudget: z.number().nonnegative(),
  missions: z.array(
    z.object({
      code: z.string(),
      reward: z.number(),
      claimed: z.boolean(),
      progress: z.object({
        current: z.number(),
        target: z.number(),
        complete: z.boolean(),
      }),
    }),
  ),
  quiz: z
    .object({
      version: z.string(),
      questions: z.array(z.string()),
      policy: z.unknown(),
    })
    .nullable(),
});
const labels: Record<string, string> = {
  POLICY_AWARENESS: "Hiểu nguyên tắc cộng đồng",
  GOOD_BEHAVIOR_STREAK: "Duy trì hoạt động tích cực",
  COMMITMENT_RECOVERY: "Hoàn thành cam kết học tập",
};
export function RecoveryPanel() {
  const runtime = useConnections();
  const query = useConnectionQuery(["reputation", "recovery"], async (signal) =>
    parse(recovery, await runtime.call("/reputation/recovery", { signal })),
  );
  const command = useConnectionCommand([["reputation"]]);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState("");
  const [quizOpen, setQuizOpen] = useState(false);
  async function submit(path: string, body?: unknown) {
    const result = await command.run(JSON.stringify([path, body]), async () =>
      parse(
        z.object({ passed: z.boolean(), awarded: z.number() }),
        await runtime.call(path, {
          method: "POST",
          body,
          replayAfterRenewal: false,
        }),
      ),
    );
    if (result) {
      setNotice(
        result.passed
          ? `Đã ghi nhận ${result.awarded} điểm.`
          : "Chưa đạt. Bạn có thể xem lại và thử lần nữa.",
      );
      void query.refetch();
    }
  }
  return (
    <Panel title="Phục hồi uy tín">
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error ?? command.error}
        retry={query.refetch}
      />
      <RouteButton secondary href="/policies">
        Đọc nguyên tắc sử dụng
      </RouteButton>
      <Button
        variant="paper"
        disabled={command.pending || command.uncertain}
        onPress={() =>
          void command.run("acknowledge-policy", async () => {
            const result = await runtime.call(
              "/reputation/restrictions/policy-acknowledgement",
              {
                method: "POST",
                replayAfterRenewal: false,
              },
            );
            if (runtime.isCurrent())
              setNotice(
                "Đã xác nhận chính sách. Quyền được cập nhật theo điều kiện tài khoản.",
              );
            return result;
          })
        }
      >
        Tôi đã đọc và xác nhận chính sách
      </Button>
      {query.data && !query.data.eligible && (
        <Copy muted>Hiện bạn không có nhiệm vụ phục hồi.</Copy>
      )}
      {query.data?.eligible && (
        <>
          <Copy muted>
            Còn tối đa {query.data.remainingBudget} điểm có thể nhận trong kỳ.
          </Copy>
          {query.data.missions.map((item) => (
            <Panel
              key={item.code}
              title={labels[item.code] ?? "Nhiệm vụ phục hồi"}
            >
              <Copy>
                {item.claimed
                  ? "Đã nhận điểm"
                  : `${item.progress.current}/${item.progress.target} · +${item.reward} điểm`}
              </Copy>
              {!item.claimed &&
                (item.code === "POLICY_AWARENESS" ? (
                  <Button
                    variant="paper"
                    onPress={() => setQuizOpen(!quizOpen)}
                  >
                    {quizOpen ? "Thu gọn câu hỏi" : "Làm bài kiểm tra"}
                  </Button>
                ) : (
                  <Button
                    disabled={
                      !item.progress.complete ||
                      command.pending ||
                      command.uncertain
                    }
                    onPress={() =>
                      void submit("/reputation/recovery/claim", {
                        code: item.code,
                      })
                    }
                  >
                    Nhận điểm
                  </Button>
                ))}
            </Panel>
          ))}
          {quizOpen && query.data.quiz && (
            <>
              {query.data.quiz.questions.map((question, index) => (
                <Panel key={question} title={question}>
                  {[true, false].map((answer) => (
                    <Button
                      key={String(answer)}
                      variant={answers[index] === answer ? "craft" : "paper"}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          [index]: answer,
                        }))
                      }
                    >
                      {answer ? "Đúng" : "Sai"}
                    </Button>
                  ))}
                </Panel>
              ))}
              <Button
                disabled={
                  command.pending ||
                  command.uncertain ||
                  query.data.quiz.questions.some(
                    (_, index) => answers[index] === undefined,
                  )
                }
                onPress={() =>
                  void submit("/reputation/recovery/quiz", {
                    version: query.data!.quiz!.version,
                    answers: query.data!.quiz!.questions.map(
                      (_, index) => answers[index],
                    ),
                  })
                }
              >
                Gửi bài kiểm tra
              </Button>
            </>
          )}
        </>
      )}
      {!!notice && <Copy>{notice}</Copy>}
      {command.uncertain && (
        <>
          <Copy muted>Chưa rõ kết quả. Bạn có thể gửi lại để kiểm tra.</Copy>
          <Button
            variant="paper"
            disabled={command.pending}
            onPress={() => void command.retry()}
          >
            Kiểm tra kết quả
          </Button>
        </>
      )}
    </Panel>
  );
}
