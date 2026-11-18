import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
import { useRouter } from "expo-router";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { appColors } from "@/constants/theme";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { useMyMaterialPages } from "../hooks/use-materials";
import { useOwnerMaterialActions } from "../hooks/use-owner-material-actions";
import type { OwnerMaterialAction } from "../utils/owner-material-actions";
import { materialFailure } from "../utils/material-failure";
import {
  filterOwnerMaterials,
  materialFilters,
  materialStatuses,
  type MaterialFilter,
} from "../utils/owner-material-presentation";
import { OwnerMaterialCard } from "../components/owner-material-card";
import { OwnerMaterialActionDialog } from "../components/owner-material-dialogs";
import { ownerMaterialStyles as styles } from "../components/owner-material.styles";

function Separator() {
  return <View style={styles.separator} />;
}

function ownerActionError(uncertain: unknown, error: unknown) {
  if (uncertain)
    return "Chưa xác nhận được kết quả. Kiểm tra trạng thái trước khi tiếp tục.";
  return error ? materialFailure(error) : undefined;
}

function ownerEmptyState({
  query,
  filter,
  search,
  mutationLocked,
  onClear,
}: {
  query: ReturnType<typeof useMyMaterialPages>;
  filter: MaterialFilter;
  search: string;
  mutationLocked: boolean;
  onClear: () => void;
}) {
  if (!query.data || query.error || query.isLoading) return null;
  const filtered = !!(query.items.length || filter !== "ALL" || search.trim());
  let description = "Đăng tài liệu hữu ích để cùng cộng đồng học tập.";
  if (filtered)
    description = query.hasNextPage
      ? "Thử bộ lọc khác hoặc xem thêm tài liệu để tiếp tục tìm."
      : "Thử tên khác hoặc bỏ bộ lọc.";
  return (
    <EmptyState
      title={
        filtered ? "Không có tài liệu phù hợp" : "Chia sẻ tài liệu đầu tiên"
      }
      description={description}
      icon="file"
      titleStyle={styles.heading}
      action={!mutationLocked && filtered ? "Bỏ bộ lọc" : undefined}
      onAction={onClear}
    />
  );
}

export function PostedMaterialsContent({
  onCreateDisabledChange,
  onMutationLockChange,
}: Readonly<{
  onCreateDisabledChange: (disabled: boolean) => void;
  onMutationLockChange?: (locked: boolean) => void;
}>) {
  const runtime = useConnections();
  const command = useOwnerMaterialActions();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MaterialFilter>("ALL");
  const query = useMyMaterialPages(filter === "ALL" ? undefined : filter);
  const [archiveId, setArchiveId] = useState<string>();
  const [action, setAction] = useState<OwnerMaterialAction>("archive");
  const [refreshing, setRefreshing] = useState(false);
  const filtered = filterOwnerMaterials(query.items, filter, search);
  const archive = query.items.find((row) => row.id === archiveId);
  const mutationLocked = !!command.pending || !!command.uncertain;
  const disabled =
    mutationLocked || query.isFetching || !!query.error || !runtime.enabled;
  useEffect(() => {
    onCreateDisabledChange(disabled);
    return () => onCreateDisabledChange(true);
  }, [disabled, onCreateDisabledChange]);
  useEffect(() => {
    onMutationLockChange?.(mutationLocked);
    return () => onMutationLockChange?.(false);
  }, [mutationLocked, onMutationLockChange]);
  const error = ownerActionError(command.uncertain, command.error);
  const refresh = async () => {
    if (command.pending || refreshing || query.isFetching || !runtime.enabled)
      return;
    setRefreshing(true);
    try {
      if (command.uncertain) await command.reconcile();
      const result = await query.refetch();
      if (!result.isError) command.resetFeedback();
    } finally {
      setRefreshing(false);
    }
  };
  const edit = (id: string) => {
    router.push(`/materials/${id}/edit`);
  };
  const reconcile = async () => {
    if (await command.reconcile()) setArchiveId(undefined);
  };
  const readRetry = query.isFetchNextPageError ? query.fetchNextPage : refresh;
  return (
    <>
      <RefreshableFlatList
        data={filtered}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={() => {
          void refresh();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Input
              hideLabel
              label="Tìm tài liệu"
              placeholder={
                query.hasNextPage
                  ? "Tìm trong danh sách đã tải"
                  : "Tìm theo tên tài liệu hoặc tệp"
              }
              value={search}
              onChangeText={setSearch}
              maxLength={150}
              rightAccessory={
                <Icon name="search" size={18} color={appColors.muted} />
              }
            />
            {!runtime.enabled && (
              <Text style={styles.meta}>
                Đăng nhập để quản lý tài liệu của bạn.
              </Text>
            )}
            <FilterBar
              options={materialFilters.map((status) => ({
                value: status,
                label:
                  status === "ALL"
                    ? "Hiện tại"
                    : materialStatuses[status].label,
                accessibilityLabel: `Lọc tài liệu: ${status === "ALL" ? "Hiện tại" : materialStatuses[status].label}`,
              }))}
              value={filter}
              disabled={mutationLocked}
              onChange={(value) => {
                if (mutationLocked) return;
                setArchiveId(undefined);
                command.resetFeedback();
                setFilter(value);
              }}
              label="Lọc tài liệu đã đăng"
            />
            <ConnectionFeedback
              loading={query.isLoading}
              error={query.error}
              retry={command.pending ? undefined : readRetry}
            />
            {!!error && (
              <FormNotice
                tone={command.uncertain ? "warning" : "error"}
                compact
              >
                {error}
              </FormNotice>
            )}
            {command.uncertain && (
              <Button
                variant="paper"
                size="sm"
                disabled={!!command.pending}
                onPress={() => void reconcile()}
              >
                {command.pending ? "Đang kiểm tra…" : "Kiểm tra kết quả"}
              </Button>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <OwnerMaterialCard
            material={item}
            disabled={disabled}
            submitting={
              command.pending?.action === "submit" &&
              command.pending.id === item.id
            }
            onOpen={() => {
              if (!disabled) router.push(`/materials/${item.id}/owner`);
            }}
            onEdit={() => edit(item.id)}
            onSubmit={() => {
              setAction("submit");
              setArchiveId(item.id);
            }}
            onDelete={() => {
              setAction("delete");
              setArchiveId(item.id);
            }}
            onArchive={() => {
              setAction("archive");
              setArchiveId(item.id);
            }}
            onWithdraw={() => {
              setAction("withdraw");
              setArchiveId(item.id);
            }}
          />
        )}
        ListEmptyComponent={ownerEmptyState({
          query,
          filter,
          search,
          mutationLocked,
          onClear: () => {
            if (mutationLocked) return;
            setFilter("ALL");
            setSearch("");
          },
        })}
        ListFooterComponent={
          query.hasNextPage ? (
            <View style={styles.footer}>
              <Button
                variant="paper"
                size="sm"
                disabled={
                  query.isFetching || !!command.pending || !!command.uncertain
                }
                onPress={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? "Đang tải…" : "Xem thêm tài liệu"}
              </Button>
            </View>
          ) : null
        }
      />
      <OwnerMaterialActionDialog
        material={archive}
        action={action}
        busy={!!command.pending}
        disabled={disabled}
        uncertain={!!command.uncertain}
        error={error}
        onClose={() => setArchiveId(undefined)}
        onConfirm={() => {
          if (archive)
            void command.run(action, archive).then((result) => {
              if (result && runtime.isCurrent()) setArchiveId(undefined);
            });
        }}
        onReconcile={() => void reconcile()}
      />
    </>
  );
}
