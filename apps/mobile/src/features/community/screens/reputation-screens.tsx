import { Button } from "@/components/Button";
import { Text, View } from "react-native";
import { FeaturePage, RouteButton } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { RecoveryPanel } from "../components/recovery-panel";
import { useReputationPolicy } from "../hooks/use-reputation-policy";
import { ReputationPolicyContent } from "../components/reputation-policy-content";
import { ReputationSummary } from "../components/reputation-summary";
import { ReputationScoreCard } from "../components/reputation-score-card";
import { ReputationHistory } from "../components/reputation-history";
import { historyStyles as styles } from "../components/reputation-history.styles";
import { reputationStyles as ui } from "../components/reputation.styles";

export function ReputationScreen() {
  return <ReputationView history={false} />;
}
export function ReputationHistoryScreen() {
  return <ReputationView history />;
}
function ReputationView({ history }: Readonly<{ history: boolean }>) {
  const policy = useReputationPolicy();
  const { query, data } = policy;
  const showPolicy =
    !history &&
    (!!data?.policyNotice?.length ||
      policy.acknowledged ||
      policy.needsCheck ||
      !!policy.error);
  return (
    <FeaturePage
      title={history ? "Lịch sử uy tín" : "Uy tín"}
      back={history ? "/reputation" : "/profile"}
      backBehavior="history"
      refreshing={query.isRefetching}
      onRefresh={() => void policy.refresh()}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={showPolicy ? undefined : query.error}
        retry={() => policy.refresh()}
      />
      {query.denied && (
        <Text style={styles.meta}>
          Thông tin uy tín hiện không khả dụng cho tài khoản này.
        </Text>
      )}
      {data &&
        (history ? (
          <ReputationScoreCard data={data} compact />
        ) : (
          <ReputationSummary data={data} />
        ))}
      {showPolicy && (
        <View style={ui.card}>
          <ReputationPolicyContent policy={policy} context="overview" />
        </View>
      )}
      {data && history && (
        <>
          <ReputationHistory items={query.items} />
          {query.hasNextPage && (
            <Button
              variant="paper"
              disabled={query.isFetching || policy.pending || !!query.error}
              onPress={() => void query.fetchNextPage()}
            >
              Xem thêm lịch sử
            </Button>
          )}
        </>
      )}
      {data && !history && <RecoveryPanel />}
      {data && !history && (
        <ReputationHistory
          items={query.items.slice(0, 3)}
          title="Thay đổi gần đây"
        />
      )}
      {data && !history && (
        <RouteButton secondary href="/reputation/history">
          Xem tất cả lịch sử
        </RouteButton>
      )}
    </FeaturePage>
  );
}
