import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import {
  useConnections,
  useConnectionCommand,
  ConnectionFeedback,
  connectionError,
} from "@/features/connections";
import { parse, resourcePath, uuid } from "@/lib/http/contracts";
import { useLearningPath } from "../hooks/use-learning-paths-api";
import { useRefreshLearningPath } from "../hooks/use-refresh-learning-path";

const receipt = z.object({
  pathId: uuid,
  status: z.literal("COMPLETED"),
  operationId: uuid.nullable(),
  gross: z
    .string()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .nullable(),
  fee: z
    .string()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .nullable(),
});
type Receipt = z.infer<typeof receipt>;
export function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useLearningPath(id);
  const runtime = useConnections(),
    cache = useQueryClient(),
    refresh = useRefreshLearningPath();
  const command = useConnectionCommand<Receipt>([["learning-paths"]]);
  const scope = JSON.stringify([...runtime.key, id]);
  const [confirmed, setConfirmed] = useState<{
    scope: string;
    receipt: Receipt;
  }>();
  const path = query.data;
  const completed =
    !!path?.plans.length &&
    path.plans.every(
      (plan) =>
        plan.sessions.length === plan.totalSessions &&
        plan.sessions.every((session) => session.status === "COMPLETED"),
    );
  const result =
    confirmed?.scope === scope
      ? confirmed.receipt
      : cache.getQueryData<Receipt>([...runtime.key, "settlement", id]);
  async function finish(value: Receipt | undefined) {
    if (!value || !runtime.isCurrent()) return;
    setConfirmed({ scope, receipt: value });
    cache.setQueryData([...runtime.key, "settlement", id], value);
    await Promise.allSettled([
      refresh(id),
      cache.invalidateQueries({ queryKey: ["wallet", runtime.userId] }),
    ]);
  }
  return (
    <FeaturePage
      demo={false}
      title="Quyết toán cuối lộ trình"
      back={`/paths/${id}`}
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {path && (
        <Panel title="Hoàn Credit & quyết toán lộ trình">
          <Copy>Trạng thái lộ trình: {path.status}</Copy>
          <Copy>
            {path.agreement.exchangeType === "TWO_WAY"
              ? "Trao đổi hai chiều: mỗi người được hoàn 96% Credit đã giữ của chính mình; 4% là phí nền tảng."
              : path.agreement.teacherId === runtime.userId
                ? "Bạn là người dạy: nhận 96% Credit thỏa thuận; 4% là phí nền tảng."
                : "Học một chiều: 96% Credit đã giữ được trả cho người dạy; 4% là phí nền tảng."}
          </Copy>
          {path.settledAt && (
            <Copy>
              Đã quyết toán lúc{" "}
              {new Date(path.settledAt).toLocaleString("vi-VN")}
            </Copy>
          )}
          <Copy>
            Quyết toán cần tất cả buổi học hoàn thành, hết thời hạn khiếu nại và
            không có tranh chấp đang chặn.
          </Copy>
          <Copy>
            {path.settledAt || result
              ? "Máy chủ đã xác nhận quyết toán. Xem biến động thực tế trong ví."
              : completed
                ? "Các buổi đã hoàn tất. Chờ hệ thống kiểm tra điều kiện quyết toán."
                : "Credit tiếp tục được giữ đến khi lộ trình đủ điều kiện."}
          </Copy>
          {result && (
            <>
              <Copy>
                Tổng Credit cả thỏa thuận: {result.gross ?? "Chưa có dữ liệu"}{" "}
                CR
              </Copy>
              <Copy>
                Phí cả thỏa thuận: {result.fee ?? "Chưa có dữ liệu"} CR
              </Copy>
              <Copy>Mã giao dịch: {result.operationId ?? "Chưa có"}</Copy>
            </>
          )}
          <Button
            disabled={
              (!completed && !path.settledAt) ||
              query.isFetching ||
              !!query.error ||
              command.pending ||
              command.uncertain ||
              !["ACTIVE", "COMPLETED"].includes(path.status)
            }
            onPress={() => {
              void command
                .run("settlement:" + id, async () => {
                  const value = parse(
                    receipt,
                    await runtime.call(
                      resourcePath("sessions/paths", id) + "/settlement",
                      { method: "POST", replayAfterRenewal: false },
                    ),
                  );
                  if (value.pathId !== id)
                    throw new Error("Unexpected settlement");
                  return value;
                })
                .then(finish);
            }}
          >
            {path.settledAt
              ? "Tải kết quả quyết toán"
              : "Kiểm tra / yêu cầu quyết toán"}
          </Button>
          {!!command.error && (
            <FormNotice tone="error">
              {connectionError(command.error)}
            </FormNotice>
          )}
          {command.uncertain && (
            <Button
              disabled={command.pending}
              onPress={() => {
                void command.retry().then(finish);
              }}
            >
              Kiểm tra lại kết quả quyết toán
            </Button>
          )}
          <RouteButton secondary href="/wallet/history">
            Xem sổ giao dịch ví
          </RouteButton>
        </Panel>
      )}
    </FeaturePage>
  );
}
