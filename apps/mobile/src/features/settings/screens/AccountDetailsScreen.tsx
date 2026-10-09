import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import {
  appColors as colors,
  fonts,
  typography,
  radius,
} from "@/constants/theme";
import { useAuthSession } from "@/features/auth";

const accountStatuses = {
  ACTIVE: "Đang hoạt động",
  PENDING_VERIFICATION: "Chờ xác minh",
  LOCKED: "Đã khóa",
  SUSPENDED: "Tạm đình chỉ",
  DEACTIVATED: "Đã vô hiệu hóa",
};

export function AccountDetailsScreen() {
  const { session, account } = useAuthSession();
  const router = useRouter();
  if (!session || !account) return <Redirect href="/login" />;
  const fields = [
    { label: "Tên hiển thị", value: account.profile.fullName },
    { label: "Email đăng nhập", value: account.email },
    {
      label: "Xác minh email",
      value: account.emailVerified ? "Đã xác minh" : "Chưa xác minh",
    },
    {
      label: "Trạng thái tài khoản",
      value: accountStatuses[account.accountStatus],
    },
  ];
  return (
    <AppScreenLayout
      title="Tài khoản"
      selected="Cài đặt"
      back={{ href: "/account-settings", label: "Quay lại cài đặt" }}
    >
      {() => (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.caption}>
            Thông tin đăng nhập của bạn. Email không hiển thị trên hồ sơ công
            khai.
          </Text>
          <View style={styles.card}>
            {fields.map((field, index) => (
              <View
                key={field.label}
                style={[styles.field, index > 0 && styles.separator]}
              >
                <Text style={styles.caption}>{field.label}</Text>
                <Text selectable style={styles.value}>
                  {field.value}
                </Text>
              </View>
            ))}
          </View>
          <Button
            variant="secondary"
            onPress={() => router.push("/edit-profile")}
          >
            Chỉnh sửa hồ sơ
          </Button>
        </ScrollView>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  field: { padding: 16, gap: 4 },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  value: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
});
