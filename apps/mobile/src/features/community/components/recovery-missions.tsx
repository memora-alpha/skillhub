import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Copy, Panel } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnectionQuery,
  useConnections,
} from "@/features/connections";
import type { RecoveryMissionCode } from "../api/community-api";
import { useCommunityApi } from "../hooks/use-community";

const titles: Record<RecoveryMissionCode, string> = {
  POLICY_AWARENESS: "Tìm hiểu chính sách",
  GOOD_BEHAVIOR_STREAK: "14 ngày cải thiện hành vi",
  COMMITMENT_RECOVERY: "Hoàn thành hai buổi học đã chốt",
};

export function RecoveryMissions() {
  const runtime = useConnections();
  const api = useCommunityApi();
  const cache = useQueryClient();
  const query = useConnectionQuery(["reputation-recovery"], (signal) =>
    api.recovery(signal),
  );
  const [answers, setAnswers] = useState<Partial<Record<number, boolean>>>({});
  const mutation = useMutation({
    mutationFn: (code: RecoveryMissionCode) => {
      if (code !== "POLICY_AWARENESS") return api.claimRecovery(code);
      const quiz = query.data?.quiz;
      if (!quiz) throw new Error("Recovery quiz unavailable");
      return api.submitRecoveryQuiz(
        quiz.version,
        quiz.questions.map((_, i) => answers[i] === true),
      );
    },
    onSuccess: async () => {
      if (!runtime.isCurrent()) return;
      await Promise.all([
        cache.invalidateQueries({ queryKey: [...runtime.key, "reputation"] }),
        query.refetch(),
      ]);
    },
  });
  if (!runtime.isCurrent() || !runtime.enabled) return null;
  const data = query.data;
  return (
    <Panel title="Nhiệm vụ phục hồi uy tín">
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error ?? mutation.error}
      />
      {data && !data.eligible && (
        <Copy>Bạn hiện chưa đủ điều kiện tham gia.</Copy>
      )}
      {data?.eligible && (
        <Copy muted>
          Còn tối đa +{data.remainingBudget} điểm thưởng trong cửa sổ 30 ngày
          hiện tại.
        </Copy>
      )}
      {mutation.data && (
        <Copy>
          {mutation.data.passed
            ? `Đã ghi nhận nhiệm vụ · +${mutation.data.awarded} điểm.`
            : "Chưa đạt 80%. Hãy đọc lại chính sách và thử lại."}
        </Copy>
      )}
      {data?.missions.map((mission) => (
        <Panel key={mission.code} title={titles[mission.code]}>
          <Copy>
            {mission.claimed
              ? "Đã ghi nhận"
              : `${mission.progress.current}/${mission.progress.target} · Thưởng tối đa +${mission.reward} điểm`}
          </Copy>
          {!mission.claimed &&
            mission.code === "POLICY_AWARENESS" &&
            data.quiz && (
              <>
                {data.quiz.policy.map((rule) => (
                  <Copy key={rule}>{rule}</Copy>
                ))}
                {data.quiz.questions.map((question, index) => (
                  <Panel key={question} title={question}>
                    {[true, false].map((value) => (
                      <Button
                        key={String(value)}
                        variant="paper"
                        disabled={mutation.isPending}
                        onPress={() =>
                          setAnswers((current) => ({
                            ...current,
                            [index]: value,
                          }))
                        }
                      >
                        {answers[index] === value ? "Đã chọn · " : ""}
                        {value ? "Đúng" : "Sai"}
                      </Button>
                    ))}
                  </Panel>
                ))}
                <Button
                  disabled={
                    mutation.isPending ||
                    Object.keys(answers).length !== data.quiz.questions.length
                  }
                  onPress={() => mutation.mutate(mission.code)}
                >
                  Nộp bài
                </Button>
              </>
            )}
          {!mission.claimed && mission.code !== "POLICY_AWARENESS" && (
            <Button
              disabled={!mission.progress.complete || mutation.isPending}
              onPress={() => mutation.mutate(mission.code)}
            >
              Xác minh và nhận thưởng
            </Button>
          )}
        </Panel>
      ))}
    </Panel>
  );
}
