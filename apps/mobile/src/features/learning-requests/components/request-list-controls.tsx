import { Pressable, ScrollView, Text, View } from "react-native";
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
  const content = (
    <>
      <Icon
        name="plus"
        size={compact ? 14 : 16}
        color={signedInChrome.surface}
      />
      <Text style={styles.publishText}>Tạo yêu cầu</Text>
    </>
  );
  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tạo yêu cầu học"
        hitSlop={4}
        onPress={() => router.navigate("/requests/new")}
        style={({ pressed }) => [
          styles.publish,
          styles.publishCompact,
          pressed && { opacity: 0.75 },
        ]}
      >
        {content}
      </Pressable>
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
      {content}
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      accessibilityLabel={label}
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option }}
          aria-selected={value === option}
          onPress={() => onChange(option)}
          style={[styles.tab, value === option && styles.activeTab]}
        >
          <Text style={[styles.tabText, value === option && styles.activeText]}>
            {uiLabel(option)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
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
