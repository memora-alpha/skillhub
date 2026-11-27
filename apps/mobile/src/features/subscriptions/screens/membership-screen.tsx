import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { SubscriptionFeedback } from "../components/subscription-feedback";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { useMembership, useSubscriptionPlans } from "../hooks/use-membership";
import { useSubscriptionActions } from "../hooks/use-subscription-actions";
import { confirmationChanged } from "../utils/subscription-confirmation";
import { useSubscriptions } from "../context/subscriptions-provider";
import { CurrentPlanLink } from "../components/current-plan-link";
import { PlanSelection } from "../components/plan-selection";
import { PlanActionFooter } from "../components/plan-action-footer";
import { SubscriptionConfirmation } from "../components/subscription-confirmation";
import { SubscriptionRecovery } from "../components/subscription-recovery";
import { membershipStyles as s } from "../components/subscription.styles";
import {
  planAction,
  subscriptionFailure,
} from "../utils/subscription-presentation";
import type { Interval, PlanCode } from "../api/subscription-contracts";

export function MembershipScreen() {
  const runtime = useConnections();
  return <MembershipContent key={JSON.stringify(runtime.key)} />;
}
function MembershipContent() {
  const router = useRouter();
  const me = useMembership();
  const plans = useSubscriptionPlans();
  const { state } = useSubscriptions();
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [selectedCode, setSelectedCode] = useState<PlanCode>("CREATOR");
  const catalog = [...(plans.data ?? [])].sort((a, b) =>
    a.planCode.localeCompare(b.planCode),
  );
  const selected =
    catalog.find((plan) => plan.planCode === selectedCode) ?? catalog[0];
  const actions = useSubscriptionActions(me.data);
  const stale = confirmationChanged(actions.confirmation, me.data, plans.data);
  const pending =
    actions.busy ||
    state.stage === "pending" ||
    state.stage === "uncertain" ||
    state.stage === "loading";
  const readBlocked =
    me.isFetching ||
    !!me.error ||
    !me.data ||
    plans.isFetching ||
    !!plans.error;
  const chargeBlocked = pending || readBlocked || state.stage !== "ready";
  const selectedAction = selected
    ? planAction(selected, interval, me.data?.subscription ?? null)
    : undefined;
  const selectionBlocked =
    selectedAction === "schedule" ? pending || readBlocked : chargeBlocked;
  const refresh = () => {
    void me.refetch();
    void plans.refetch();
  };
  const readError = me.error ?? plans.error;
  const confirmationBlocked =
    pending ||
    readBlocked ||
    stale ||
    (actions.confirmation?.kind === "charge" && chargeBlocked);
  const select = () => {
    if (selected && !selectionBlocked) void actions.select(selected, interval);
  };
  return (
    <FeaturePage
      title="Gói thành viên"
      back="/profile"
      backBehavior="history"
      onRefresh={refresh}
      refreshing={me.isRefetching || plans.isRefetching}
      rightAction={
        <Button
          variant="ghost"
          size="sm"
          leadingIcon="clock"
          accessibilityLabel="Lịch sử thanh toán gói"
          onPress={() => router.push("/membership/history")}
        >
          Lịch sử
        </Button>
      }
      stickyFooter={
        selected && me.data ? (
          <PlanActionFooter
            plan={selected}
            interval={interval}
            current={me.data.subscription}
            disabled={selectionBlocked}
            busy={actions.busy || state.stage === "pending"}
            onSelect={select}
          />
        ) : undefined
      }
    >
      <ConnectionFeedback loading={me.isLoading || plans.isLoading} />
      {!!readError && (
        <View style={s.stack}>
          <SubscriptionFeedback>
            {subscriptionFailure(readError)}
          </SubscriptionFeedback>
          <Button variant="paper" onPress={refresh}>
            Tải lại thông tin
          </Button>
        </View>
      )}
      {me.data && (
        <CurrentPlanLink
          membership={me.data}
          onManage={() => router.push("/membership/manage")}
        />
      )}
      <SubscriptionRecovery />
      {actions.busy && !actions.confirmation && (
        <Text style={s.muted}>Đang lấy báo giá mới nhất…</Text>
      )}
      {selected && (
        <PlanSelection
          plans={catalog}
          selected={selected}
          interval={interval}
          current={me.data?.subscription ?? null}
          onSelect={setSelectedCode}
          onInterval={setInterval}
        />
      )}
      {plans.data?.length === 0 && !plans.error && (
        <EmptyState
          icon="award"
          title="Chưa có gói mở đăng ký"
          description="Bạn vẫn có thể xem quyền lợi hiện tại và quản lý gia hạn."
        />
      )}
      <SubscriptionConfirmation
        confirmation={actions.confirmation}
        busy={actions.busy || state.stage === "pending"}
        blocked={confirmationBlocked}
        stale={stale}
        onClose={actions.close}
        onConfirm={() => {
          void actions.confirm();
        }}
      />
    </FeaturePage>
  );
}
