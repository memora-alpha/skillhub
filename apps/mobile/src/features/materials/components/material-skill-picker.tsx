import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { appColors as colors } from "@/constants/theme";
import {
  useConnectionList,
  useCatalogName,
  ConnectionFeedback,
} from "@/features/connections";
import { useMaterialsApi } from "../hooks/use-materials";
import { materialStyles as styles } from "./material.styles";
import { MaterialFieldError } from "./material-field-error";
import { MaterialSkillSheet } from "./material-skill-sheet";

export function MaterialSkillPicker({
  value,
  onChange,
  disabled = false,
  allowAll = false,
  compact = false,
  error,
}: Readonly<{
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  allowAll?: boolean;
  compact?: boolean;
  error?: string;
}>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const api = useMaterialsApi();
  const name = useCatalogName(value || undefined);
  const query = useConnectionList(
    ["materials", "skill-options", term],
    (cursor, signal) => api.skills(term, cursor, signal),
    open && !disabled,
    { cancelOnDisable: true },
  );
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  return (
    <View
      style={[
        styles.section,
        compact && { maxWidth: "100%", alignSelf: "flex-start" },
      ]}
    >
      {!allowAll && <Text style={styles.label}>Kỹ năng liên quan</Text>}
      <Button
        variant="paper"
        size="sm"
        leadingIcon="filter"
        icon={compact ? undefined : "chevron"}
        disabled={disabled}
        style={error ? { borderColor: colors.error } : undefined}
        accessibilityLabel="Chọn kỹ năng tài liệu"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
      >
        {name.data ??
          (value
            ? "Kỹ năng đã chọn"
            : allowAll
              ? compact
                ? "Kỹ năng"
                : "Tất cả kỹ năng"
              : "Chọn kỹ năng")}
      </Button>
      <MaterialFieldError message={error} />
      {open && !disabled && (
        <MaterialSkillSheet onClose={close}>
          <ScreenLoadingBoundary>
            <RefreshableFlatList
              data={query.items}
              keyExtractor={(row) => row.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerBody}
              ListHeaderComponent={
                <View style={styles.section}>
                  <Input
                    label="Tìm kỹ năng"
                    hideLabel
                    placeholder="Tìm trong danh mục kỹ năng"
                    value={search}
                    onChangeText={setSearch}
                    maxLength={100}
                  />
                  <ConnectionFeedback
                    loading={query.isLoading}
                    error={query.error}
                    retry={query.refetch}
                  />
                  {allowAll && (
                    <Button
                      variant="paper"
                      onPress={() => {
                        onChange("");
                        close();
                      }}
                    >
                      Tất cả kỹ năng
                    </Button>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={item.name}
                  accessibilityState={{ checked: item.id === value }}
                  onPress={() => {
                    onChange(item.id);
                    close();
                  }}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      flex: 0,
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                    item.id === value && styles.activeChoice,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.text, { flex: 1 }]}>{item.name}</Text>
                  {item.id === value && (
                    <Icon name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                query.data && !query.error && !query.items.length ? (
                  <Text style={styles.meta}>
                    Không tìm thấy kỹ năng phù hợp.
                  </Text>
                ) : null
              }
              ListFooterComponent={
                query.hasNextPage ? (
                  <Button
                    variant="paper"
                    disabled={query.isFetching}
                    onPress={() => void query.fetchNextPage()}
                  >
                    Xem thêm kỹ năng
                  </Button>
                ) : null
              }
            />
          </ScreenLoadingBoundary>
        </MaterialSkillSheet>
      )}
    </View>
  );
}
