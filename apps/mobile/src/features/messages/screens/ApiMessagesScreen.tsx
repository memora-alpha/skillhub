import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { useIsFocused, useRouter } from "expo-router";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";
import { ConnectionFeedback } from "@/features/connections";
import { ConversationRow } from "../components/ConversationRow";
import { useInboxGroups } from "../hooks/use-inbox-groups";
import { RequestInboxCard } from "../components/RequestInboxCard";
import { messageColors as colors } from "../constants/theme";

export function ApiMessagesScreen() {
  const query = useInboxGroups(),
    router = useRouter();
  const focused = useIsFocused();
  const quietError = isTransientReadError(query.error);
  useEffect(() => {
    if (
      focused &&
      !query.items.length &&
      query.hasNextPage &&
      !query.isFetching &&
      !query.error
    )
      void query.loadMore();
  }, [
    focused,
    query.items.length,
    query.hasNextPage,
    query.isFetching,
    query.error,
    query.loadMore,
  ]);
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () => query.refetch(),
  });
  let footer = null;
  if (quietError && query.hasNextPage)
    footer = (
      <ActivityIndicator
        presentation="placeholder"
        accessibilityLabel="Đang tải thêm hội thoại"
      />
    );
  else if (query.hasNextPage)
    footer = (
      <Button
        variant="secondary"
        disabled={query.isFetching}
        onPress={() => {
          void query.loadMore();
        }}
      >
        Xem thêm
      </Button>
    );
  return (
    <AppScreenLayout
      title="Tin nhắn"
      selected="Tin nhắn"
      contentStyle={styles.background}
      rightAction={
        <Button
          variant="secondary"
          size="sm"
          style={styles.proposalAction}
          onPress={() => router.push("/proposals")}
        >
          <Text style={styles.proposalLabel}>Đề xuất</Text>
        </Button>
      }
    >
      {() => (
        <FlatList
          data={query.items}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ConversationSeparator}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.error)
              void query.loadMore();
          }}
          ListHeaderComponent={
            <ConnectionFeedback
              loading={
                (!query.data && (query.isPending || quietError)) ||
                (!query.items.length && query.hasNextPage && !query.error)
              }
              error={quietError ? undefined : query.error}
              retry={query.refetch}
            />
          }
          ListEmptyComponent={
            !query.isPending &&
            !query.hasNextPage &&
            (!query.error || (query.data && quietError)) ? (
              <EmptyState
                icon="message"
                title="Chưa có tin nhắn"
                description="Đề xuất nhận được và các cuộc trò chuyện sẽ xuất hiện tại đây."
                action="Xem đề xuất"
                onAction={() => router.push("/proposals")}
              />
            ) : null
          }
          ListFooterComponent={footer}
          renderItem={({ item }) =>
            item.kind === "request" ? (
              <RequestInboxCard
                group={item}
                deferTitleRead={query.titlesPending}
              />
            ) : (
              <ConversationRow item={item.item} />
            )
          }
        />
      )}
    </AppScreenLayout>
  );
}

function ConversationSeparator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  proposalAction: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: appRadius.button,
    borderColor: appColors.primaryMuted,
    backgroundColor: colors.orangeSoft,
  },
  proposalLabel: {
    ...typography.secondary,
    color: appColors.primary,
    fontFamily: fonts.semibold,
    includeFontPadding: false,
  },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 24,
  },
  separator: { height: 10 },
});
