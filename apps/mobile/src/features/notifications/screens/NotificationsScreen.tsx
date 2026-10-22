import { useRef, useState } from "react";
import { FlatList, StyleSheet, View, type ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { useChatEvents } from "@/features/messages";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { Copy } from "@/components/feature-page";
import { NotificationActions } from "../components/notification-actions";
import { NotificationRow } from "../components/notification-row";
import {
  NotificationTabs,
  type NotificationFilter,
} from "../components/notification-tabs";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../hooks/use-notifications";
import { notificationTarget } from "../utils/notification-target";
import type { InboxNotification } from "../api/notifications-api";
import { useNotificationMotion } from "../hooks/use-notification-motion";

function Separator() {
  return <View style={styles.separator} />;
}

export function NotificationsScreen() {
  const runtime = useConnections();
  return <NotificationsInbox key={JSON.stringify(runtime.key)} />;
}

function NotificationsInbox() {
  const query = useNotifications(),
    mark = useMarkNotificationRead();
  const events = useChatEvents(),
    runtime = useConnections(),
    router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>("Tất cả");
  const [busy, setBusy] = useState<string>();
  const motionEnabled = useNotificationMotion();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<InboxNotification>[] }) => {
      setVisibleIds(new Set(viewableItems.map(({ item }) => item.id)));
    },
  ).current;
  const inFlight = useRef(false);
  const items = query.items.filter(
    (item) => filter === "Tất cả" || !item.readAt,
  );
  const act = async (item: InboxNotification) => {
    if (inFlight.current || !runtime.isCurrent()) return;
    inFlight.current = true;
    setBusy(item.id);
    try {
      if (!item.readAt) await mark.mutateAsync(item.id);
      runtime.assertCurrent();
      const target = notificationTarget(item);
      if (target) router.push(target);
    } catch {
      // Mutation feedback stays inline and the item remains available for retry.
    } finally {
      inFlight.current = false;
      if (runtime.isCurrent()) setBusy(undefined);
    }
  };
  return (
    <AppScreenLayout
      title="Thông báo"
      titleContent={
        <NotificationTabs
          value={filter}
          onChange={setFilter}
          unreadCount={query.items.filter((item) => !item.readAt).length}
          hasMore={!!query.hasNextPage}
        />
      }
      selected="Thông báo"
      back={{ href: "/home", label: "Quay lại", behavior: "history" }}
      rightAction={
        <NotificationActions
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          disabled={!runtime.enabled || query.isFetching || !!busy}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    >
      {() => (
        <FlatList
          data={items}
          extraData={{ visibleIds, motionEnabled, busy }}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.page}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            void query.refetch();
          }}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              {(query.isLoading || !!query.error) && (
                <ConnectionFeedback
                  loading={query.isLoading}
                  error={query.error}
                  retry={query.refetch}
                />
              )}
              {!!mark.error && <ConnectionFeedback error={mark.error} />}
              {!!events.error && (
                <>
                  <FormNotice tone="info">
                    Cập nhật trực tiếp đang gián đoạn. Kéo xuống để làm mới hoặc
                    kết nối lại.
                  </FormNotice>
                  <Button variant="paper" onPress={events.retry}>
                    Kết nối lại thông báo
                  </Button>
                </>
              )}
              {!runtime.enabled && <Copy>Đăng nhập lại để tải thông báo.</Copy>}
            </View>
          }
          ListEmptyComponent={
            !query.isPending && !query.error ? (
              <EmptyState
                icon="bell"
                title={
                  filter === "Chưa đọc"
                    ? "Đã đọc hết thông báo đã tải"
                    : "Chưa có thông báo"
                }
                description={
                  query.hasNextPage
                    ? "Tải thêm để xem các thông báo trước đó."
                    : "Thông báo mới sẽ xuất hiện tại đây khi có cập nhật."
                }
              />
            ) : null
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                variant="paper"
                disabled={query.isFetching}
                onPress={() => {
                  void query.fetchNextPage({ cancelRefetch: false });
                }}
              >
                {query.isFetchingNextPage ? "Đang tải…" : "Tải thêm thông báo"}
              </Button>
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              busy={busy === item.id}
              disabled={!!busy || !runtime.enabled}
              animateTitle={motionEnabled && visibleIds.has(item.id)}
              onPress={() => {
                void act(item);
              }}
            />
          )}
        />
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  page: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  separator: { height: 10 },
  header: { gap: 12 },
});
