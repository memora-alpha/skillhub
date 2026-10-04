import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { InfoModal } from "@/components/InfoModal";
import { colors, fonts } from "@/constants/theme";
import { AuthLayout } from "../components/AuthLayout";
import {
  AuthDivider,
  GoogleButton,
  authStyles,
} from "../components/AuthControls";
import { useMockSession } from "../context/MockSession";
import { demoProfile, newUserEmail } from "../mocks/auth";
import { isEmail } from "../utils/validateRegistration";

export function LoginScreen() {
  const router = useRouter();
  const { enterDemo } = useMockSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"google" | "forgot" | null>(null);
  const passwordInput = useRef<TextInput>(null);
  const enter = (google = false) => {
    Keyboard.dismiss();
    enterDemo({
      ...demoProfile,
      email: google ? demoProfile.email : email.trim().toLowerCase(),
      isNew: !google && email.trim().toLowerCase() === newUserEmail,
    });
    router.replace("/home");
  };
  const submit = () => {
    if (!email.trim() || !password)
      return setError("Vui lòng nhập email và mật khẩu.");
    if (!isEmail(email)) return setError("Email chưa đúng định dạng.");
    setError("");
    enter();
  };
  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục hành trình của bạn."
    >
      <View style={authStyles.fields}>
        <GoogleButton
          label="Đăng nhập với Google"
          onPress={() => setNotice("google")}
        />
        <AuthDivider label="hoặc đăng nhập bằng email" />
        {!!error && (
          <View style={styles.alert} accessibilityLiveRegion="polite">
            <Icon name="alert" size={16} color="#8A0000" />
            <Text style={styles.error}>{error}</Text>
          </View>
        )}
        <Input
          label="Email"
          required
          placeholder="email@gmail.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          keyboardType="email-address"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
        />
        <Input
          ref={passwordInput}
          label="Mật khẩu"
          required
          password
          placeholder="Mật khẩu của bạn"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <View style={styles.options}>
          <Checkbox
            checked={remember}
            onChange={setRemember}
            label="Ghi nhớ đăng nhập"
          >
            Ghi nhớ đăng nhập
          </Checkbox>
          <Pressable
            accessibilityRole="button"
            onPress={() => setNotice("forgot")}
          >
            <Text style={authStyles.link}>Quên mật khẩu?</Text>
          </Pressable>
        </View>
        <Button size="lg" onPress={submit}>
          Đăng nhập
        </Button>
        <Text style={authStyles.footer}>
          Chưa có tài khoản?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => router.replace("/register")}
          >
            Đăng ký
          </Text>
        </Text>
        <Text style={authStyles.hint}>
          Thử: new@test.com (người mới) hoặc bất kỳ email khác
        </Text>
      </View>
      <InfoModal
        title={
          notice === "google"
            ? "Đăng nhập với Google — bản demo"
            : notice === "forgot"
              ? "Quên mật khẩu?"
              : null
        }
        onClose={() => setNotice(null)}
        confirmLabel={notice === "google" ? "Tiếp tục bản demo" : "Đã hiểu"}
        onConfirm={notice === "google" ? () => enter(true) : undefined}
      >
        {notice === "google"
          ? "Mở trang chủ bằng hồ sơ mẫu Nguyễn Lan Anh. Bản demo không kết nối tài khoản Google."
          : "Khôi phục mật khẩu sẽ được bổ sung khi kết nối backend. Hiện tại bạn có thể dùng email hợp lệ và mật khẩu bất kỳ để xem trang chủ demo."}
      </InfoModal>
    </AuthLayout>
  );
}
const styles = StyleSheet.create({
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0A0A0",
    backgroundColor: colors.errorLight,
  },
  error: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#8A0000",
    includeFontPadding: false,
  },
});
