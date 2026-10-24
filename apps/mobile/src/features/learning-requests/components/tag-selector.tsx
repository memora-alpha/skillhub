import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { useTagOptions } from "../hooks/use-request-options";
import { RequestFailure, RequestLoading } from "./request-state";
import { RequestMultiSelect } from "./request-multi-select";
import type { TagOption } from "../types";

export function TagSelector({
  value,
  onChange,
  disabled = false,
  error,
}: Readonly<{
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const labels = useRef(new Map<string, TagOption>());
  useEffect(() => {
    const timer = setTimeout(
      () => setKeyword(search.normalize("NFC").trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const query = useTagOptions(
    keyword || undefined,
    (expanded && !disabled) || value.length > 0,
  );
  const options = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((tag) => [tag.id, tag]),
    ).values(),
  ];
  options.forEach((tag) => labels.current.set(tag.id, tag));
  const displayed = [
    ...value.flatMap((id) =>
      labels.current.has(id) ? [labels.current.get(id)!] : [],
    ),
    ...(expanded ? options : []),
  ];
  return (
    <View style={{ gap: 8 }}>
      <Copy>Tag (không bắt buộc)</Copy>
      <Button
        variant="paper"
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
      >
        {expanded ? "Đóng danh mục tag" : "Chọn tag"}
      </Button>
      {expanded && (
        <>
          <Input
            label="Tìm tag"
            value={search}
            onChangeText={setSearch}
            maxLength={120}
            editable={!disabled}
          />
          {query.isPending && <RequestLoading />}
          {query.error && (
            <RequestFailure
              error={query.error}
              retry={() => void query.refetch()}
            />
          )}
          {!query.isPending && !query.error && !options.length && (
            <Copy muted>Chưa có tag phù hợp.</Copy>
          )}
        </>
      )}
      <RequestMultiSelect
        value={value}
        options={displayed}
        onChange={onChange}
        disabled={disabled}
        error={error}
      />
      {expanded && query.hasNextPage && (
        <Button
          variant="paper"
          disabled={disabled || query.isFetching}
          onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
        >
          {query.isFetchingNextPage ? "Đang tải..." : "Tải thêm tag"}
        </Button>
      )}
    </View>
  );
}
