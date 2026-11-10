import { PathReadFeedback } from "../components/PathReadFeedback";
import { AgreementProgressPanel } from "../components/agreement-progress";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useLocalSearchParams } from "expo-router";
import { RouteButton } from "@/components/feature-page";
import { Icon } from "@/components/Icon";
import {
  FlowPage as FeaturePage,
  FlowSection as Panel,
} from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { creditShortfall } from "@/lib/http/scheduling-error";
import { AppError } from "@/lib/http/errors";
import { ScheduleValidationFeedback } from "../components/schedule-validation-feedback";
import { scheduleValidationKey } from "../utils/invalid-schedule-items";
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
import {
  canValidateForFinalize,
  finalizationValidationKey,
} from "../utils/policy-api";
import { LockedScheduleSummary } from "../components/locked-schedule-summary";
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
          blocked={!!query.error || query.isFetching}
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
  const [validationSnapshot, setValidationSnapshot] = useState<string>();
  const [latestAction, setLatestAction] = useState<"check" | "finalize">(
    "check",
  );
  const share = useConfirmedFormShare();
  const signature = finalizationValidationKey(path),
    agreement = path.agreement;
  const validationKey = scheduleValidationKey(path);
  const ready = canValidateForFinalize(path);
  const latestError = latestAction === "check" ? check.error : finalize.error;
  // A rejection while replaying does not settle the original unknown result.
  const feedbackError =
    latestAction === "finalize" && finalize.uncertain ? undefined : latestError;
  const invalidTime =
    feedbackError instanceof AppError &&
    feedbackError.code === "INVALID_SCHEDULE_ITEMS";
  const shortfall = creditShortfall(feedbackError, runtime.userId);
  const canTopUp =
    shortfall === "viewer" ||
    (shortfall === "unknown" &&
      (agreement.exchangeType === "TWO_WAY" ||
        agreement.learnerId === runtime.userId));
  if (path.lockedVersion !== null)
    return (
      <LockedScheduleSummary
        path={path}
        userId={runtime.userId}
        embedded={embedded}
      />
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
                Tạm giữ{" "}
                <Text style={styles.reviewEmphasis}>
                  {agreement.totalCreditPerUser} CR
                </Text>{" "}
                từ ví mỗi người cho thỏa thuận này.
              </>
            ) : (
              <>
                Tạm giữ{" "}
                <Text style={styles.reviewEmphasis}>
                  {agreement.negotiatedCredit} CR
                </Text>{" "}
                từ ví người học; người dạy không bị tạm giữ Credit.
              </>
            )}
          </ReviewBullet>
          <ReviewBullet>
            Chốt lịch sẽ xác nhận thời gian học và tạm giữ Credit theo thỏa
            thuận.
          </ReviewBullet>
        </View>
        <View style={styles.validationNote}>
          <Icon name="alert" size={16} color={colors.amber} />
          <Text style={styles.validationText}>
            Kiểm tra lịch trùng và số dư Credit trước khi chốt.
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
            if (
              !runtime.isCurrent() ||
              !ready ||
              blocked ||
              check.pending ||
              finalize.pending ||
              finalize.uncertain
            )
              return;
            setLatestAction("check");
            setValidationSnapshot(validationKey);
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
          {check.pending ? "Đang kiểm tra..." : "Kiểm tra lịch và Credit"}
        </Button>
        {invalidTime && (
          <ScheduleValidationFeedback
            path={path}
            userId={runtime.userId}
            error={latestError}
            snapshotCurrent={
              !validationSnapshot || validationSnapshot === validationKey
            }
          />
        )}
        {latestAction === "check" && !invalidTime && (
          <ConnectionFeedback
            error={latestError}
            viewerId={runtime.userId}
            errorTone="error"
            errorPresentation="notice"
          />
        )}
        {canTopUp && <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>}
        {checked === signature && (
          <FormNotice tone="success" compact>
            Đủ điều kiện tại lần kiểm tra này. Bạn có thể chốt lịch.
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
            if (
              !runtime.isCurrent() ||
              !ready ||
              blocked ||
              checked !== signature ||
              check.pending ||
              finalize.pending ||
              finalize.uncertain
            )
              return;
            setChecked(undefined);
            setLatestAction("finalize");
            setValidationSnapshot(validationKey);
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
                  refresh();
                }
              });
          }}
        >
          {finalize.pending
            ? "Đang chốt lịch..."
            : "Chốt lịch và tạm giữ Credit"}
        </Button>
        {latestAction === "finalize" && !invalidTime && !finalize.uncertain && (
          <ConnectionFeedback
            error={latestError}
            viewerId={runtime.userId}
            errorTone="error"
            errorPresentation="notice"
          />
        )}
        {!embedded && (
          <ConfirmedFormFeedback conversationId={path.conversationId} />
        )}
        {finalize.uncertain && (
          <Panel title="Kiểm tra lần chốt vừa gửi">
            <FormNotice tone="warning" compact>
              Chưa nhận được kết quả chốt lịch. Hãy kiểm tra trạng thái trước
              khi chốt lại.
            </FormNotice>
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
