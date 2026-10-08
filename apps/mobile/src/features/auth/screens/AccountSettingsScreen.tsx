import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";

export function AccountSettingsScreen() {
  const router = useRouter();
  const { logoutAll } = useAuthActions();
  return (
    <AuthLayout
      title="Bảo mật tài khoản"
      subtitle="Quản lý các phiên đăng nhập đang hoạt động."
    >
      <View style={authStyles.fields}>
        <Text>
          Đăng xuất khỏi tất cả thiết bị sẽ yêu cầu đăng nhập lại trên mọi
          phiên.
        </Text>
        <Button
          variant="secondary"
          disabled={logoutAll.isPending}
          onPress={() => {
            if (!logoutAll.isPending) logoutAll.mutate();
          }}
        >
          {logoutAll.isPending
            ? "Đang đăng xuất..."
            : "Đăng xuất tất cả thiết bị"}
        </Button>
        <Button
          variant="ghost"
          disabled={logoutAll.isPending}
          onPress={() => {
            if (!logoutAll.isPending) router.back();
          }}
        >
          Quay lại
        </Button>
      </View>
    </AuthLayout>
  );
}
