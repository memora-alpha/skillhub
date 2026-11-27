import { Text, View } from "react-native";
import { FeaturePage } from "@/components/feature-page";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { SubscriptionFeedback } from "../components/subscription-feedback";
import { useSubscriptionCharges } from "../hooks/use-membership";
import {
  creditLabel,
  dateLabel,
  planName,
  subscriptionFailure,
} from "../utils/subscription-presentation";
import { membershipStyles as s } from "../components/subscription.styles";

const labels = {
  PURCHASE: "Đăng ký gói",
  UPGRADE: "Nâng cấp",
  RENEWAL: "Gia hạn",
  RECORDING_ADDON: "Mua thêm phút ghi hình",
};
export function SubscriptionHistoryScreen() {
  const query = useSubscriptionCharges();
  const retry = () => {
    void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch());
  };
  return (
    <FeaturePage
      title="Thanh toán gói"
      back="/membership"
      backBehavior="history"
      scrollable={false}
    >
      <RefreshableFlatList
        data={query.items}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        keyExtractor={(row) => row.id}
        refreshing={query.isRefetching}
        onRefresh={() => {
          void query.refetch();
        }}
        ListHeaderComponent={
          <View style={s.stack}>
            <ConnectionFeedback loading={query.isLoading} />
            {!!query.error && (
              <>
                <SubscriptionFeedback>
                  {subscriptionFailure(query.error)}
                </SubscriptionFeedback>
                <Button variant="paper" onPress={retry}>
                  Thử lại
                </Button>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.between}>
              <Text style={[s.heading, s.grow]}>{labels[item.kind]}</Text>
              <Text
                style={[
                  s.amount,
                  s.accent,
                  { flexShrink: 1, textAlign: "right" },
                ]}
              >
                −{creditLabel(item.amount)}
              </Text>
            </View>
            <Text style={s.body}>
              {planName(item.planCode)}
              {item.kind === "RECORDING_ADDON"
                ? ` · ${item.quantity} gói phút`
                : ""}
            </Text>
            <Text style={s.muted}>{dateLabel(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={
          query.data && !query.error && !query.isLoading ? (
            <EmptyState
              icon="clock"
              title="Chưa có thanh toán gói"
              description="Các khoản đăng ký, nâng cấp và gia hạn sẽ xuất hiện ở đây."
            />
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <Button
              variant="paper"
              disabled={query.isFetching}
              onPress={() => {
                void query.fetchNextPage();
              }}
            >
              Xem thêm
            </Button>
          ) : null
        }
      />
    </FeaturePage>
  );
}
