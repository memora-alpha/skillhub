import { Controller, type UseFormReturn } from "react-hook-form";
import { useOfferingPicker } from "../hooks/use-offering-picker";
import { RequestTextField } from "./request-text-field";
import { Input } from "@/components/Input";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";

import { RequestSection } from "./request-section";
import { RequestPickerSheet } from "./request-picker-sheet";
import { RequestMultiSelect } from "./request-multi-select";
import { RequestFailure, RequestLoading } from "./request-state";

import type { RequestDraft } from "../schemas/request-form";
import type { OwnerRequest } from "../types";

import { requestFormStyles as styles } from "./request-form.styles";

export function RequestOfferingFields({
  form,
  disabled,
  initial,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
  initial?: OwnerRequest;
}>) {
  const selected = form.watch("offeredSharingSkillIds");
  const {
    query,
    expanded,
    setExpanded,
    search,
    setSearch,
    visibleCount,
    setVisibleCount,
    options,
    matches,
    selectionLabels,
  } = useOfferingPicker(selected, disabled, initial);
  let emptyLabel = options.length
    ? "Bạn đã chọn hết kỹ năng hiện có."
    : "Chưa có kỹ năng công khai để chọn.";
  if (search.trim()) emptyLabel = "Không tìm thấy kỹ năng phù hợp.";
  const overview = form.watch("teachingOverview");
  let summary = "Thêm kỹ năng và nội dung bạn có thể chia sẻ";
  if (overview.trim()) summary = "Đã thêm nội dung có thể dạy";
  if (selected.length) summary = `${selected.length} kỹ năng đã chọn`;
  return (
    <RequestSection
      title="Bạn có thể dạy"
      icon="users"
      tone="forest"
      compact
      collapsible
      summary={summary}
      hasError={
        !!(
          form.formState.errors.teachingOverview ||
          form.formState.errors.offeredSharingSkillIds
        )
      }
      disabled={disabled}
    >
      <RequestTextField
        form={form}
        name="teachingOverview"
        label="Nội dung có thể dạy"
        multiline
        disabled={disabled}
        placeholder="Bạn có thể hướng dẫn lại những gì cho bạn học?"
        hint="20–3000 ký tự khi điền."
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={styles.label}>Kỹ năng có thể dạy</Text>
        <Text style={styles.hint}>{selected.length}/10</Text>
      </View>
      <Controller
        control={form.control}
        name="offeredSharingSkillIds"
        render={({ field, fieldState }) => (
          <RequestMultiSelect
            value={field.value}
            onChange={field.onChange}
            options={matches.slice(0, visibleCount)}
            showOptions={false}
            showCount={false}
            showClear={false}
            selectionLabels={selectionLabels}
            disabled={disabled}
            error={fieldState.error?.message}
          />
        )}
      />
      <Button
        variant="paper"
        leadingIcon="plus"
        accessibilityState={{ expanded }}
        disabled={disabled}
        accessibilityLabel="Chọn kỹ năng có thể dạy"
        onPress={() => setExpanded(true)}
      >
        {selected.length ? "Thêm kỹ năng" : "Chọn kỹ năng có thể dạy"}
      </Button>
      <RequestPickerSheet
        title="Kỹ năng có thể dạy"
        open={expanded && !disabled}
        onClose={() => setExpanded(false)}
      >
        {expanded && (
          <>
            <Input
              label="Tìm kỹ năng có thể dạy"
              hideLabel
              placeholder="Nhập tên kỹ năng..."
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setVisibleCount(6);
              }}
              editable={!disabled}
              maxLength={100}
            />
            <RequestMultiSelect
              value={selected}
              onChange={(ids) =>
                form.setValue("offeredSharingSkillIds", ids, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              options={matches.slice(0, visibleCount)}
              showSelection={false}
              disabled={disabled}
            />
            <RequestMultiSelect
              value={selected}
              onChange={(ids) =>
                form.setValue("offeredSharingSkillIds", ids, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              options={[]}
              selectionLabels={selectionLabels}
              showOptions={false}
              showCount={false}
              showClear={false}
              disabled={disabled}
            />
            {query.isPending && <RequestLoading />}
            {query.error && (
              <RequestFailure
                error={query.error}
                retry={() => {
                  if (query.isFetchNextPageError) {
                    void query.fetchNextPage({ cancelRefetch: false });
                    return;
                  }
                  void query.refetch();
                }}
              />
            )}
            {search.trim() && query.hasNextPage && query.isFetching && (
              <Copy muted>Đang tìm trong các kỹ năng còn lại...</Copy>
            )}
            {!query.isPending &&
              !query.error &&
              !matches.length &&
              !query.hasNextPage && <Copy muted>{emptyLabel}</Copy>}
            {matches.length > visibleCount && (
              <Button
                variant="ghost"
                disabled={disabled}
                onPress={() => setVisibleCount(visibleCount + 6)}
              >
                Xem thêm kỹ năng
              </Button>
            )}
          </>
        )}
        {expanded && query.hasNextPage && !search.trim() && (
          <Button
            variant="paper"
            disabled={disabled || query.isFetching}
            onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
          >
            {query.isFetchingNextPage
              ? "Đang tải..."
              : "Tải thêm kỹ năng có thể dạy"}
          </Button>
        )}
      </RequestPickerSheet>
    </RequestSection>
  );
}
