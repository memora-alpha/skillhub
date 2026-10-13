import { Controller, type UseFormReturn } from "react-hook-form";
import { useOfferingPicker } from "../hooks/use-offering-picker";
import { RequestTextField } from "./request-text-field";
import { Input } from "@/components/Input";
import { Pressable, Text } from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";

import { RequestSection } from "./request-section";
import { RequestMultiSelect } from "./request-multi-select";
import { RequestFailure, RequestLoading } from "./request-state";

import type { RequestDraft } from "../schemas/request-form";
import type { OwnerRequest } from "../types";

import {
  requestFormColors as colors,
  requestFormStyles as styles,
} from "./request-form.styles";

export function RequestOfferingFields({
  form,
  disabled,
  initial,
}: {
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
  initial?: OwnerRequest;
}) {
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
  return (
    <RequestSection
      title="Bạn có thể dạy"
      icon="users"
      tone="forest"
      subtitle="Chia sẻ thế mạnh để tìm bạn trao đổi phù hợp"
    >
      <RequestTextField
        form={form}
        name="teachingOverview"
        label="Nội dung có thể dạy (không bắt buộc)"
        multiline
        disabled={disabled}
        placeholder="Bạn có thể hướng dẫn lại những gì cho bạn học?"
        hint="20–3000 ký tự khi điền."
      />
      <Copy muted>Chọn kỹ năng đang công khai trong hồ sơ của bạn.</Copy>
      <Controller
        control={form.control}
        name="offeredSharingSkillIds"
        render={({ field, fieldState }) => (
          <RequestMultiSelect
            value={field.value}
            onChange={field.onChange}
            options={matches.slice(0, visibleCount)}
            showOptions={false}
            selectionLabels={selectionLabels}
            disabled={disabled}
            error={fieldState.error?.message}
          />
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        style={[
          styles.option,
          styles.action,
          { justifyContent: "center" },
          disabled && { opacity: 0.6 },
        ]}
        disabled={disabled}
        accessibilityLabel={
          expanded ? "Thu gọn kỹ năng có thể dạy" : "Thêm kỹ năng có thể dạy"
        }
        onPress={() => setExpanded(!expanded)}
      >
        <Icon
          name={expanded ? "close" : "plus"}
          size={16}
          color={colors.muted}
        />
        <Text style={[styles.label, { fontSize: 13 }]}>
          {expanded
            ? "Thu gọn danh sách"
            : selected.length
              ? "Thêm kỹ năng"
              : "Chọn kỹ năng có thể dạy"}
        </Text>
      </Pressable>
      {expanded && (
        <>
          <Input
            label="Tìm kỹ năng có thể dạy"
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
          {query.isPending && <RequestLoading />}
          {query.error && (
            <RequestFailure
              error={query.error}
              retry={() =>
                void (query.isFetchNextPageError
                  ? query.fetchNextPage({ cancelRefetch: false })
                  : query.refetch())
              }
            />
          )}
          {search.trim() && query.hasNextPage && query.isFetching && (
            <Copy muted>Đang tìm trong các kỹ năng còn lại...</Copy>
          )}
          {!query.isPending &&
            !query.error &&
            !matches.length &&
            !query.hasNextPage && (
              <Copy muted>
                {search.trim()
                  ? "Không tìm thấy kỹ năng phù hợp."
                  : options.length
                    ? "Bạn đã chọn hết kỹ năng hiện có."
                    : "Chưa có kỹ năng công khai để chọn."}
              </Copy>
            )}
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
    </RequestSection>
  );
}
