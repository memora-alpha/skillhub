import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
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
}: Readonly<{
  value: string;
  onChange: (id: string) => void;
  error?: string;
  locked?: boolean;
  allowAll?: boolean;
  disabled?: boolean;
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
    expanded && !locked && !disabled,
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
            style={requestFormStyles.action}
            disabled={disabled}
            onPress={() => setExpanded((open) => !open)}
          >
            {selectionLabel}
          </Button>
          {expanded && (
            <>
              <Input
                label="Tìm kỹ năng"
                editable={!disabled}
                placeholder="Tìm trong danh mục kỹ năng"
                value={search}
                onChangeText={setSearch}
                maxLength={100}
                hint="Nhập ít nhất 2 ký tự để tìm trong toàn bộ danh mục."
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
              <View style={requestFormStyles.badgeList}>
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
                      requestFormStyles.choiceBadge,
                      value === skill.id && requestFormStyles.selected,
                      (pressed || disabled) && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        requestFormStyles.choiceLabel,
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
              onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
            >
              {query.isFetchingNextPage ? "Đang tải..." : "Tải thêm kỹ năng"}
            </Button>
          )}
        </>
      )}
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </View>
  );
}
