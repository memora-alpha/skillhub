import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { RequestPickerSheet } from "./request-picker-sheet";
import { useSkillOptions, useSkillName } from "../hooks/use-requests";
import { RequestFailure, RequestLoading } from "./request-state";
import {
  requestFormColors as colors,
  requestFormStyles,
} from "./request-form.styles";
export function SkillSelector({
  value,
  onChange,
  error,
  locked = false,
  allowAll = false,
  disabled = false,
  active = true,
}: Readonly<{
  value: string;
  onChange: (id: string) => void;
  error?: string;
  locked?: boolean;
  allowAll?: boolean;
  disabled?: boolean;
  active?: boolean;
}>) {
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setKeyword(search.normalize("NFC").trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const keywordLength = [...keyword].length;
  const query = useSkillOptions(
    keywordLength >= 2 ? keyword : undefined,
    active && expanded && !locked && !disabled,
  );
  const selected = useSkillName(value || undefined);
  const all =
    query.data?.pages
      .flatMap((page) => page.items)
      .filter((skill) => skill.status === "ACTIVE") ?? [];
  const options = [
    ...new Map(all.map((skill) => [skill.id, skill])).values(),
  ].filter(
    (skill) =>
      keywordLength !== 1 ||
      skill.name
        .toLocaleLowerCase("vi")
        .includes(keyword.toLocaleLowerCase("vi")),
  );
  let selectionLabel = allowAll ? "Tất cả kỹ năng" : "Chọn kỹ năng muốn học";
  if (value) selectionLabel = "Đã chọn kỹ năng";
  selectionLabel = selected.data?.name ?? selectionLabel;
  return (
    <View style={{ gap: 10 }}>
      {!allowAll && <Copy>Kỹ năng muốn học *</Copy>}
      {locked ? (
        <>
          <Copy>
            {selected.data?.name ?? "Thông tin kỹ năng chưa khả dụng"}
          </Copy>
          <Copy muted>Kỹ năng được giữ nguyên sau lần đăng đầu tiên.</Copy>
        </>
      ) : (
        <>
          <Button
            variant="paper"
            style={[
              requestFormStyles.action,
              { justifyContent: "space-between" },
            ]}
            disabled={disabled}
            icon="chevron"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((open) => !open)}
          >
            {selectionLabel}
          </Button>
          <RequestPickerSheet
            title="Chọn kỹ năng muốn học"
            open={active && expanded && !disabled}
            onClose={() => setExpanded(false)}
          >
            {expanded && (
              <>
                <Input
                  label="Tìm kỹ năng"
                  hideLabel
                  editable={!disabled}
                  placeholder="Tìm trong danh mục kỹ năng"
                  value={search}
                  onChangeText={setSearch}
                  maxLength={100}
                />
                {allowAll && (
                  <Button
                    variant="paper"
                    disabled={disabled}
                    onPress={() => {
                      onChange("");
                      setExpanded(false);
                    }}
                  >
                    Tất cả kỹ năng
                  </Button>
                )}
                {query.isPending && <RequestLoading />}
                {query.error && (
                  <RequestFailure
                    error={query.error}
                    retry={() => void query.refetch()}
                  />
                )}
                <View style={{ gap: 8 }}>
                  {options.map((skill) => (
                    <Pressable
                      key={skill.id}
                      accessibilityRole="radio"
                      accessibilityLabel={skill.name}
                      accessibilityState={{
                        checked: value === skill.id,
                        disabled,
                      }}
                      hitSlop={4}
                      disabled={disabled}
                      onPress={() => {
                        onChange(skill.id);
                        setExpanded(false);
                      }}
                      style={({ pressed }) => [
                        requestFormStyles.option,
                        value === skill.id && requestFormStyles.selected,
                        (pressed || disabled) && { opacity: 0.6 },
                      ]}
                    >
                      <Text
                        style={[
                          requestFormStyles.choiceLabel,
                          { flex: 1 },
                          value === skill.id && { color: colors.primary },
                        ]}
                      >
                        {skill.name}
                      </Text>
                      {value === skill.id && (
                        <Icon name="check" size={13} color={colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
                {!query.isPending && !query.error && options.length === 0 && (
                  <Copy muted>Chưa có kỹ năng phù hợp.</Copy>
                )}
              </>
            )}
            {expanded && query.hasNextPage && (
              <Button
                variant="paper"
                disabled={disabled || query.isFetching}
                onPress={() =>
                  void query.fetchNextPage({ cancelRefetch: false })
                }
              >
                {query.isFetchingNextPage ? "Đang tải..." : "Tải thêm kỹ năng"}
              </Button>
            )}
          </RequestPickerSheet>
        </>
      )}
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </View>
  );
}
