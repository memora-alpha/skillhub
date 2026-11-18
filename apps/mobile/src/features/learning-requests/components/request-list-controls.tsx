import { Text, View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
import { IconAction } from "@/components/icon-action";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { signedInChrome } from "@/constants/theme";
import { uiLabel } from "@/constants/ui-copy";
import { requestListStyles as styles } from "./request-list.styles";

export function RequestCreateButton({
  compact = false,
}: Readonly<{
  compact?: boolean;
}>) {
  const router = useRouter();
  if (compact) {
    return (
      <IconAction
        icon="plus"
        label="Tạo yêu cầu học"
        onPress={() => router.navigate("/requests/new")}
      />
    );
  }
  return (
    <Button
      variant="craft"
      size="sm"
      style={styles.publish}
      onPress={() => router.navigate("/requests/new")}
      accessibilityLabel="Tạo yêu cầu học"
    >
      <Icon name="plus" size={16} color={signedInChrome.surface} />
      <Text style={styles.publishText}>Tạo yêu cầu</Text>
    </Button>
  );
}

export function RequestTabs({
  options,
  value,
  onChange,
  label,
}: Readonly<{
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}>) {
  return (
    <FilterBar
      options={options.map((option) => ({
        value: option,
        label: uiLabel(option),
      }))}
      value={value}
      onChange={onChange}
      label={label}
      role="tab"
    />
  );
}

export function RequestListSummary({
  count,
  recommended = false,
}: Readonly<{
  count: number;
  recommended?: boolean;
}>) {
  return (
    <View style={styles.between}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.summary}>Đã tải {count} yêu cầu</Text>
      </View>
      <Text style={styles.caption}>
        {recommended ? "Phù hợp với bạn" : "Mới nhất"}
      </Text>
    </View>
  );
}
