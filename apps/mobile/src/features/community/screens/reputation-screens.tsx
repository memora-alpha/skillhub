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

export function ReputationScreen() {
  return <ReputationView history={false} />;
}
export function ReputationHistoryScreen() {
  return <ReputationView history />;
}
function ReputationView({ history }: Readonly<{ history: boolean }>) {
  const policy = useReputationPolicy();
  const { query, data } = policy;
  return (
    <FeaturePage
      title={history ? "Lịch sử uy tín" : "Điểm uy tín"}
      back={history ? "/reputation" : "/profile"}
      backBehavior="history"
      demo={false}
      subtitle={
        history ? "Theo dõi các lần tăng, giảm điểm uy tín." : undefined
      }
      refreshing={query.isRefetching}
      onRefresh={() => void policy.refresh()}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={() => policy.refresh()}
      />
      {query.denied && (
        <Text style={styles.meta}>
          Thông tin uy tín hiện không khả dụng cho tài khoản này.
        </Text>
      )}
      {data && !history && <RecoveryPanel />}
      {data &&
        (history ? (
          <ReputationScoreCard data={data} />
        ) : (
          <ReputationSummary data={data} />
        ))}
      {!history &&
        (!!data?.policyNotice?.length ||
          policy.acknowledged ||
          policy.needsCheck ||
          !!policy.error) && (
          <View style={styles.stack}>
            <Text style={styles.heading}>Xác nhận lại quy tắc hoạt động</Text>
            <ReputationPolicyContent policy={policy} />
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
      {!history && (
        <RouteButton secondary href="/reputation/history">
          Lịch sử điểm & vi phạm
        </RouteButton>
      )}
    </FeaturePage>
  );
}
