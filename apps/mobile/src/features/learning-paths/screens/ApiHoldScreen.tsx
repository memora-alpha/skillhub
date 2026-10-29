import { PathReadFeedback } from "../components/PathReadFeedback";
import { AgreementProgressPanel } from "../components/agreement-progress";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
import { Copy, RouteButton } from "@/components/feature-page";
import { Icon } from "@/components/Icon";
import {
  FlowPage as FeaturePage,
  FlowSection as Panel,
} from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppError } from "@/lib/http/errors";
import {
  ConnectionFeedback,
  useConnectionCommand,
  useConnections,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { canValidateForFinalize } from "../utils/policy-api";
import {
  useConfirmedFormShare,
  ConfirmedFormFeedback,
} from "@/features/messages/state";
import { confirmAndShare } from "../api/confirm-and-share";
import { scheduledMessage } from "../utils/scheduled-message";
import { usePullRefresh } from "../hooks/use-pull-refresh";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function ApiHoldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id);
  const pullRefresh = usePullRefresh(query.refetch);
  return (
    <FeaturePage
      title="Kiểm tra & chốt lịch"
      demo={false}
      back={`/paths/${id}`}
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    >
      <PathReadFeedback query={query} />
      {query.data && (
        <HoldContent
          key={query.data.id}
          path={query.data}
          blocked={!!query.error}
          refresh={query.refetch}
        />
      )}
    </FeaturePage>
  );
}
export function ApiFinalizePanel(
  props: Readonly<{
    path: ApiLearningPath;
    blocked: boolean;
    refresh: () => unknown;
  }>,
) {
  return <HoldContent key={props.path.id} {...props} embedded />;
}
function HoldContent({
  path,
  blocked,
  refresh,
  embedded = false,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  refresh: () => unknown;
  embedded?: boolean;
}>) {
  const api = useLearningPathsApi(),
    runtime = useConnections(),
    check = useConnectionCommand([["learning-paths", path.id]]),
    finalize = useConnectionCommand([
      ["learning-paths", path.id],
      ["learning-paths", "mine"],
    ]);
  const [checked, setChecked] = useState<string>();
  const share = useConfirmedFormShare();
  const signature = JSON.stringify(path),
    agreement = path.agreement;
  const ready = canValidateForFinalize(path);
  if (path.lockedVersion !== null)
    return (
      <Panel title="Lịch đã chốt">
        <FormNotice tone="success" compact>
          Lịch học đã được chốt. Các buổi học của bạn đã sẵn sàng.
        </FormNotice>
        {!embedded && (
          <RouteButton href={`/paths/${path.id}/schedules`}>
            Xem các buổi học
          </RouteButton>
        )}
        {!embedded && (
          <ConfirmedFormFeedback conversationId={path.conversationId} />
        )}
      </Panel>
    );
  return (
    <>
      {!embedded && (
        <AgreementProgressPanel
          path={path}
          blocked={blocked}
          current={`/paths/${path.id}/hold`}
        />
      )}
      <Panel title="Xem lại trước khi chốt">
        <View style={styles.reviewBullets}>
          <ReviewBullet>
            <Text style={styles.reviewEmphasis}>Tổng cộng:</Text>{" "}
            {path.plans.reduce((sum, p) => sum + p.totalSessions, 0)} buổi học.
          </ReviewBullet>
          <ReviewBullet>
            {agreement.exchangeType === "TWO_WAY" ? (
              <>
                Mỗi người sẽ được tạm giữ{" "}
                <Text style={styles.reviewEmphasis}>
                  {agreement.totalCreditPerUser} CR
                </Text>{" "}
                cho toàn thỏa thuận.
              </>
            ) : (
              <>
                Người học sẽ được tạm giữ{" "}
                <Text style={styles.reviewEmphasis}>
                  {agreement.negotiatedCredit} CR
                </Text>{" "}
                cho toàn lộ trình; người dạy không tạm giữ Credit.
              </>
            )}
          </ReviewBullet>
          <ReviewBullet>
            Thao tác chốt lịch sẽ khóa thời gian học, tạo các buổi học và tạm
            giữ Credit.
          </ReviewBullet>
        </View>
        <View style={styles.validationNote}>
          <Icon name="alert" size={16} color={colors.amber} />
          <Text style={styles.validationText}>
            Hệ thống kiểm tra lịch trùng và số dư khi kiểm tra điều kiện, sau đó
            xác nhận lại khi bạn chốt lịch.
          </Text>
        </View>
        {!ready && (
          <FormNotice tone="info" compact>
            Cần đủ kế hoạch và xác nhận của người học, điều khoản chung và lịch
            của cả hai trước khi kiểm tra.
          </FormNotice>
        )}
        <Button
          variant="secondary"
          disabled={
            !ready ||
            blocked ||
            check.pending ||
            finalize.pending ||
            finalize.uncertain
          }
          onPress={() => {
            setChecked(undefined);
            void check
              .run(`validate:${path.id}`, () => api.validate(path.id))
              .then((result) => {
                if (
                  runtime.isCurrent() &&
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
        {[check.error, finalize.error].some(
          (error) =>
            error instanceof AppError &&
            error.code === "INSUFFICIENT_AVAILABLE_CREDIT",
        ) && <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>}
        {checked === signature && (
          <FormNotice tone="success" compact>
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
            finalize.pending ||
            finalize.uncertain
          }
          onPress={() => {
            void finalize
              .run(`finalize:${path.id}:${path.currentVersion}`, (identity) =>
                confirmAndShare(
                  () => api.finalize(path.id, path.currentVersion, identity),
                  (result, messageIdentity) => {
                    void share.publish(
                      path.conversationId,
                      scheduledMessage(result),
                      messageIdentity,
                    );
                  },
                  runtime.isCurrent,
                )(identity),
              )
              .then((result) => {
                if (result && runtime.isCurrent()) {
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
        {!embedded && (
          <ConfirmedFormFeedback conversationId={path.conversationId} />
        )}
        {finalize.uncertain && (
          <Panel title="Kiểm tra lần chốt vừa gửi">
            <Copy size="hint">
              Chưa rõ kết quả chốt. Tải lại trạng thái hoặc kiểm tra đúng lần
              gửi trước để tránh tạm giữ Credit hai lần.
            </Copy>
            <Button
              variant="secondary"
              disabled={blocked || finalize.pending}
              onPress={() => {
                refresh();
              }}
            >
              Tải lại trạng thái lộ trình
            </Button>
            <Button
              disabled={blocked || finalize.pending}
              onPress={() => {
                void finalize.retry().then((result) => {
                  if (result && runtime.isCurrent()) {
                    setChecked(undefined);
                    refresh();
                  }
                });
              }}
            >
              {finalize.pending
                ? "Đang kiểm tra..."
                : "Kiểm tra lại lần chốt trước"}
            </Button>
          </Panel>
        )}
      </Panel>
      {!embedded && (
        <RouteButton secondary href={`/paths/${path.id}/schedules`}>
          Xem lại lịch từng buổi
        </RouteButton>
      )}
    </>
  );
}

function ReviewBullet({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <View style={styles.reviewBullet}>
      <View style={styles.reviewDot} />
      <Text style={styles.reviewText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewBullets: { gap: 10 },
  reviewBullet: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  reviewDot: {
    width: 6,
    height: 6,
    marginTop: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.primary,
  },
  reviewText: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  reviewEmphasis: { fontFamily: fonts.bold, color: colors.ink },
  validationNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: appRadius.control,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  validationText: {
    flex: 1,
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.body,
  },
});
