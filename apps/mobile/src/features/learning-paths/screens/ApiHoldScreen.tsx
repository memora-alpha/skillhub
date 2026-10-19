import { PathReadFeedback } from "../components/PathReadFeedback";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  ConnectionFeedback,
  useConnectionCommand,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { canValidateForFinalize } from "../policy-api";

export function ApiHoldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id);
  return (
    <FeaturePage
      title="Kiểm tra & chốt lịch"
      demo={false}
      back={`/paths/${id}`}
    >
      <PathReadFeedback query={query} />
      {query.data && (
        <HoldContent
          path={query.data}
          blocked={!!query.error || query.isFetching}
          refresh={query.refetch}
        />
      )}
    </FeaturePage>
  );
}
function HoldContent({
  path,
  blocked,
  refresh,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  refresh: () => unknown;
}>) {
  const api = useLearningPathsApi(),
    check = useConnectionCommand(),
    finalize = useConnectionCommand();
  const [checked, setChecked] = useState<string>();
  const signature = JSON.stringify(path),
    agreement = path.agreement;
  const ready = canValidateForFinalize(path);
  if (path.lockedVersion !== null)
    return (
      <Panel title="Lịch đã chốt">
        <FormNotice tone="success">
          Hệ thống đã khóa phiên bản {path.lockedVersion} và ghi nhận các buổi
          học.
        </FormNotice>
        <RouteButton href={`/paths/${path.id}/schedules`}>
          Xem các buổi học
        </RouteButton>
      </Panel>
    );
  return (
    <>
      <Panel title="Xem lại trước khi chốt">
        <Copy>
          Điều khoản v{path.currentVersion} ·{" "}
          {path.plans.reduce((sum, p) => sum + p.totalSessions, 0)} buổi học.
        </Copy>
        <Copy>
          {agreement.exchangeType === "TWO_WAY"
            ? `Mỗi người sẽ được tạm giữ ${agreement.totalCreditPerUser} CR cho toàn thỏa thuận.`
            : `Người học sẽ được tạm giữ ${agreement.negotiatedCredit} CR cho toàn lộ trình; người dạy không tạm giữ Credit.`}
        </Copy>
        <Copy>
          Chốt lịch sẽ khóa lịch, tạo các buổi học và tạm giữ Credit. Hệ thống
          kiểm tra lịch trùng và số dư tại thời điểm chốt.
        </Copy>
        {!ready && (
          <FormNotice tone="info">
            Cần đủ kế hoạch và xác nhận của người học, điều khoản chung và lịch
            của cả hai trước khi kiểm tra.
          </FormNotice>
        )}
        <Button
          variant="secondary"
          disabled={!ready || blocked || check.pending || finalize.pending}
          onPress={() => {
            setChecked(undefined);
            void check
              .run(`validate:${path.id}:${path.currentVersion}`, () =>
                api.validate(path.id),
              )
              .then((result) => {
                if (
                  result?.version === path.currentVersion &&
                  result.planCount === path.plans.length &&
                  result.scheduleCount === path.plans.length
                )
                  setChecked(signature);
              });
          }}
        >
          {check.pending
            ? "Đang kiểm tra..."
            : "Kiểm tra điều kiện trên hệ thống"}
        </Button>
        <ConnectionFeedback error={check.error} />
        {checked === signature && (
          <FormNotice tone="success">
            Đủ điều kiện tại lần kiểm tra vừa rồi. Hệ thống sẽ kiểm tra lại khi
            bạn chốt lịch.
          </FormNotice>
        )}
        <Button
          disabled={
            !ready ||
            blocked ||
            checked !== signature ||
            check.pending ||
            finalize.pending
          }
          onPress={() => {
            void finalize
              .run(`finalize:${path.id}:${path.currentVersion}`, (identity) =>
                api.finalize(path.id, path.currentVersion, identity),
              )
              .then((result) => {
                if (result) {
                  setChecked(undefined);
                  refresh();
                }
              });
          }}
        >
          {finalize.pending
            ? "Đang chốt lịch..."
            : "Xác nhận chốt lịch và tạm giữ Credit"}
        </Button>
        <ConnectionFeedback error={finalize.error} />
      </Panel>
      <RouteButton secondary href={`/paths/${path.id}/schedules`}>
        Xem lại lịch từng buổi
      </RouteButton>
    </>
  );
}
