import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors, fonts } from "@/constants/theme";
import { useSkillOptions, useSkillName } from "../hooks/use-requests";
import { RequestFailure, RequestLoading } from "./request-state";
export function SkillSelector({
  value,
  onChange,
  error,
  locked = false,
  allowAll = false,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  locked?: boolean;
  allowAll?: boolean;
  disabled?: boolean;
}) {
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
  const query = useSkillOptions(keywordLength >= 2 ? keyword : undefined);
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
            disabled={disabled}
            onPress={() => setExpanded((open) => !open)}
          >
            {selected.data?.name ??
              (value
                ? "Đã chọn kỹ năng"
                : allowAll
                  ? "Tất cả kỹ năng"
                  : "Chọn kỹ năng muốn học")}
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
              {options.map((skill) => (
                <Pressable
                  key={skill.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === skill.id, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    onChange(skill.id);
                    setExpanded(false);
                  }}
                  style={{
                    padding: 12,
                    minHeight: 44,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderColor:
                      value === skill.id ? colors.primary : colors.border,
                    backgroundColor:
                      value === skill.id ? colors.primarySoft : colors.surface,
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.semibold, color: colors.ink }}
                  >
                    {skill.name}
                    {value === skill.id ? " ✓" : ""}
                  </Text>
                </Pressable>
              ))}
              {!query.isPending && !query.error && options.length === 0 && (
                <Copy muted>Chưa có kỹ năng phù hợp.</Copy>
              )}
            </>
          )}
          {expanded && query.hasNextPage && (
            <Button
              variant="paper"
              disabled={disabled || query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
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
