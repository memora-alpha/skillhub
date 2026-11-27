import { View } from "react-native";
import { useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { SubscriptionFeedback } from "../components/subscription-feedback";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { useMembership } from "../hooks/use-membership";
import { useSubscriptionActions } from "../hooks/use-subscription-actions";
import { useSubscriptions } from "../context/subscriptions-provider";
import { MembershipOverview } from "../components/membership-overview";
import { SubscriptionConfirmation } from "../components/subscription-confirmation";
import { SubscriptionRecovery } from "../components/subscription-recovery";
import { confirmationChanged } from "../utils/subscription-confirmation";
import { subscriptionFailure } from "../utils/subscription-presentation";
import { membershipStyles as s } from "../components/subscription.styles";

export function ManageMembershipScreen() {
  const runtime = useConnections();
  return <ManageContent key={JSON.stringify(runtime.key)} />;
}
function ManageContent() {
  const router = useRouter();
  const me = useMembership();
  const { state } = useSubscriptions();
  const actions = useSubscriptionActions(me.data);
  const stale = confirmationChanged(actions.confirmation, me.data);
  const pending =
    actions.busy ||
    state.stage === "pending" ||
    state.stage === "uncertain" ||
    state.stage === "loading";
  const blocked = pending || me.isFetching || !!me.error || !me.data;
  return (
    <FeaturePage
      title="Quản lý gói"
      back="/membership"
      backBehavior="history"
      onRefresh={() => {
        void me.refetch();
      }}
      refreshing={me.isRefetching}
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
    >
      <ConnectionFeedback loading={me.isLoading} />
      {!!me.error && (
        <View style={s.stack}>
          <SubscriptionFeedback>
            {subscriptionFailure(me.error)}
          </SubscriptionFeedback>
          <Button
            variant="paper"
            onPress={() => {
              void me.refetch();
            }}
          >
            Tải lại thông tin
          </Button>
        </View>
      )}
      <SubscriptionRecovery recoveryOnly />
      {me.data && (
        <MembershipOverview
          membership={me.data}
          disabled={blocked}
          onUpdate={actions.update}
          onBrowsePlans={() => router.push("/membership")}
          onOpenWallet={() => router.push("/wallet")}
        />
      )}
      <SubscriptionConfirmation
        confirmation={actions.confirmation}
        busy={actions.busy}
        blocked={blocked || stale}
        stale={stale}
        onClose={actions.close}
        onConfirm={() => {
          void actions.confirm();
        }}
      />
    </FeaturePage>
  );
}
