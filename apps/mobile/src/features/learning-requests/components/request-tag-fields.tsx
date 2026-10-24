import { Pressable, Text, View } from "react-native";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors } from "@/constants/theme";
import type { RequestDraft } from "../schemas/request-form";
import { MAX_REQUEST_TAGS } from "../schemas/request-tags";
import { useRequestTagPicker } from "../hooks/use-request-tag-picker";
import { RequestLoading, RequestFailure } from "./request-state";
import { requestFormStyles as styles } from "./request-form.styles";

function TagChip({
  label,
  proposed = false,
  disabled,
  onRemove,
}: Readonly<{
  label: string;
  proposed?: boolean;
  disabled: boolean;
  onRemove: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bỏ ${label}${proposed ? ", tag mới" : ""}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onRemove}
      style={[
        styles.chip,
        { minHeight: 44 },
        proposed && {
          backgroundColor: colors.forestSoft,
          borderColor: colors.forestSoft,
        },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          { color: proposed ? colors.forest : colors.primary },
        ]}
      >
        {label}
      </Text>
      {proposed && (
        <Text style={[styles.hint, { color: colors.forest }]}>Mới</Text>
      )}
      <Icon name="close" size={14} color={colors.muted} />
    </Pressable>
  );
}

function TagSuggestions({
  picker,
  disabled,
}: Readonly<{
  picker: ReturnType<typeof useRequestTagPicker>;
  disabled: boolean;
}>) {
  const { query, field } = picker;
  const showAdd = !!field.value.trim() && !picker.exact;
  return (
    <View style={{ gap: 8 }}>
      {query.isPending && <RequestLoading />}
      {query.error && (
        <RequestFailure
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      <View style={styles.badgeList}>
        {picker.options
          .filter((tag) => !picker.ids.includes(tag.id))
          .map((tag) => (
            <Button
              key={tag.id}
              variant="paper"
              size="sm"
              style={{ minHeight: 44, maxWidth: "100%" }}
              leadingIcon="plus"
              disabled={!picker.canChoose(tag)}
              onPress={() => picker.choose(tag)}
            >
              {tag.label}
            </Button>
          ))}
      </View>
      {showAdd && (
        <Button
          variant="ghost"
          leadingIcon="plus"
          disabled={disabled || picker.full || !picker.settled}
          onPress={picker.add}
        >
          {`Thêm tag mới “${field.value.trim()}”`}
        </Button>
      )}
      {picker.exact && picker.ids.includes(picker.exact.id) && (
        <Button
          variant="ghost"
          size="sm"
          style={{ minHeight: 44 }}
          disabled={disabled}
          onPress={picker.clearSearch}
        >
          Đã chọn · Xóa tìm kiếm
        </Button>
      )}
      {query.hasNextPage && (
        <Button
          variant="ghost"
          disabled={disabled || query.isFetching}
          onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
        >
          Xem thêm tag
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        style={{ minHeight: 44 }}
        disabled={disabled}
        onPress={() => picker.setExpanded(false)}
      >
        Thu gọn
      </Button>
    </View>
  );
}

export function RequestTagFields({
  form,
  disabled,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}>) {
  const picker = useRequestTagPicker(form, disabled);
  const { ids, proposals, field } = picker;
  const fieldError =
    form.formState.errors.tagIds?.message ??
    form.formState.errors.proposedTags?.message;
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text style={styles.label}>Tag</Text>
        <Text
          style={[styles.hint, { fontVariant: ["tabular-nums"] }]}
          accessibilityLabel={`${ids.length + proposals.length} trên 10 tag`}
        >
          {ids.length + proposals.length}/{MAX_REQUEST_TAGS}
        </Text>
      </View>
      {!!(ids.length + proposals.length) && (
        <View style={styles.badgeList}>
          {ids.map((id, index) => (
            <TagChip
              key={`tag:${id}`}
              label={picker.labels.get(id)?.label ?? `Tag đã chọn ${index + 1}`}
              disabled={disabled}
              onRemove={() =>
                picker.change(
                  "tagIds",
                  ids.filter((value) => value !== id),
                )
              }
            />
          ))}
          {proposals.map((label) => (
            <TagChip
              key={`proposal:${label}`}
              label={label}
              proposed
              disabled={disabled}
              onRemove={() =>
                picker.change(
                  "proposedTags",
                  proposals.filter((value) => value !== label),
                )
              }
            />
          ))}
        </View>
      )}
      <Input
        label="Tìm hoặc thêm tag"
        hideLabel
        ref={field.ref}
        value={field.value}
        placeholder="Tìm hoặc thêm tag"
        autoCapitalize="none"
        editable={!disabled}
        onFocus={() => picker.setExpanded(true)}
        onBlur={field.onBlur}
        onChangeText={picker.search}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={picker.add}
        error={picker.error}
        rightAccessory={<Icon name="search" size={18} color={colors.muted} />}
      />
      {picker.full && <Copy muted>Đã chọn tối đa 10 tag.</Copy>}
      {picker.expanded && !disabled && (
        <TagSuggestions picker={picker} disabled={disabled} />
      )}
      {!!proposals.length && <Copy muted>Tag mới sẽ được duyệt cùng bài.</Copy>}
      {!!fieldError && <FormNotice tone="error">{fieldError}</FormNotice>}
    </View>
  );
}
