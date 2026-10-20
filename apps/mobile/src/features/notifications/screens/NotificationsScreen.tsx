import { useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { useChatEvents } from "@/features/messages";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ChoiceGroup } from "@/components/choice-group";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { Panel, Copy, ui } from "@/components/feature-page";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../hooks/use-notifications";
import { notificationTarget } from "../utils/notification-target";
import type { InboxNotification } from "../api/notifications-api";

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
  const [filter, setFilter] = useState("Tất cả");
  const [busy, setBusy] = useState<string>();
  const inFlight = useRef(false);
  const items = query.items.filter(
    (item) => filter === "Tất cả" || !item.readAt,
  );
  const act = async (item: InboxNotification, open = false) => {
    if (inFlight.current || !runtime.isCurrent()) return;
    inFlight.current = true;
    setBusy(item.id);
    try {
      if (!item.readAt) await mark.mutateAsync(item.id);
      runtime.assertCurrent();
      const target = open && notificationTarget(item);
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
      selected="Thông báo"
      back={{ href: "/home", label: "Quay lại", behavior: "history" }}
    >
      {() => (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={ui.page}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            void query.refetch();
          }}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              <ChoiceGroup
                label="Hiển thị"
                options={["Tất cả", "Chưa đọc"]}
                value={filter}
                onChange={setFilter}
              />
              <Copy muted>
                Thông báo của tài khoản đang đăng nhập, mới nhất trước.
              </Copy>
              <Button
                variant="paper"
                disabled={query.isFetching}
                onPress={() => {
                  void query.refetch();
                }}
              >
                {query.isRefetching ? "Đang làm mới…" : "Làm mới thông báo"}
              </Button>
              <ConnectionFeedback
                loading={query.isLoading}
                error={query.error}
                retry={query.refetch}
              />
              <ConnectionFeedback error={mark.error} />
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
                    ? "Không có thông báo chưa đọc trong các mục đã tải"
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
            <Panel title={item.title} accent={!item.readAt}>
              <Badge
                label={item.readAt ? "Đã đọc" : "Chưa đọc"}
                variant={item.readAt ? "default" : "sage"}
              />
              <Copy>{item.body}</Copy>
              <Copy muted>
                {new Date(item.createdAt).toLocaleString("vi-VN")}
              </Copy>
              {!!notificationTarget(item) && (
                <Button
                  variant="paper"
                  disabled={!!busy}
                  onPress={() => {
                    void act(item, true);
                  }}
                >
                  Xem nội dung liên quan
                </Button>
              )}
              {!item.readAt && (
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onPress={() => {
                    void act(item);
                  }}
                >
                  {busy === item.id ? "Đang lưu…" : "Đánh dấu đã đọc"}
                </Button>
              )}
            </Panel>
          )}
        />
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  separator: { height: 12 },
  header: { gap: 12, marginBottom: 16 },
});
