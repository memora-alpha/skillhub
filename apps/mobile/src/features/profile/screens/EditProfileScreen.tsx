import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { colors, fonts } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileCard, profileStyles } from "../components/ProfilePrimitives";
import { profileDetails } from "../mocks/profile";

export function EditProfileScreen() {
  const router = useRouter();
  const { session, updateProfile } = useMockSession();
  const [name, setName] = useState(session?.name ?? "");
  const [bio, setBio] = useState(session?.bio ?? profileDetails.bio);
  const [website, setWebsite] = useState(session?.website ?? "");
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});
  const [saved, setSaved] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.dismissTo("/profile"), 1500);
    return () => clearTimeout(timer);
  }, [saved, router]);
  if (!session) return <Redirect href="/login" />;
  const back = () => router.dismissTo("/profile");
  const save = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Vui lòng nhập tên hiển thị.";
    if (website.trim()) {
      try {
        const url = new URL(website.trim());
        if (
          !["http:", "https:"].includes(url.protocol) ||
          !url.hostname.includes(".")
        )
          next.website = "Vui lòng nhập URL website hợp lệ (http hoặc https).";
      } catch {
        next.website = "Vui lòng nhập URL website hợp lệ (http hoặc https).";
      }
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    Keyboard.dismiss();
    updateProfile({
      name: name.trim(),
      bio: bio.trim(),
      website: website.trim(),
    });
    setSaved(true);
  };
  return (
    <ProfileLayout session={session} title="Chỉnh sửa hồ sơ" onBack={back}>
      {() => (
        <View style={styles.stack}>
          {saved && (
            <View style={styles.success} accessibilityLiveRegion="polite">
              <Icon name="check-circle" size={16} color={colors.success} />
              <Text style={styles.successLabel}>Hồ sơ đã được cập nhật!</Text>
            </View>
          )}
          <ProfileCard>
            <View style={styles.avatarRow}>
              <Avatar name={session.name} size={96} />
              <View style={styles.avatarActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setAvatarNotice(true)}
                >
                  Thay ảnh đại diện
                </Button>
                <Text style={profileStyles.caption}>JPG, PNG. Tối đa 5MB.</Text>
              </View>
            </View>
          </ProfileCard>
          <ProfileCard style={{ gap: 16 }}>
            <Text accessibilityRole="header" style={profileStyles.heading}>
              Thông tin cơ bản
            </Text>
            <Input
              label="Tên hiển thị"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setErrors((current) => ({ ...current, name: undefined }));
                setSaved(false);
              }}
              required
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Input
              label="Giới thiệu bản thân"
              value={bio}
              onChangeText={(value) => {
                setBio(value);
                setSaved(false);
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />
            <Input
              label="Website / Portfolio"
              value={website}
              placeholder="https://portfolio.com"
              onChangeText={(value) => {
                setWebsite(value);
                setErrors((current) => ({ ...current, website: undefined }));
                setSaved(false);
              }}
              error={errors.website}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </ProfileCard>
          <View style={styles.buttons}>
            <Button style={{ flex: 1 }} variant="secondary" onPress={back}>
              Hủy
            </Button>
            <Button style={{ flex: 1 }} onPress={save} disabled={saved}>
              Lưu thay đổi
            </Button>
          </View>
          <InfoModal
            title={avatarNotice ? "Thay ảnh đại diện" : null}
            onClose={() => setAvatarNotice(false)}
          >
            Chọn ảnh từ thiết bị sẽ được bổ sung sau. Phiên demo hiện dùng ảnh
            đại diện bằng chữ cái, đúng mẫu Figma.
          </InfoModal>
        </View>
      )}
    </ProfileLayout>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 20 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  avatarActions: { gap: 8, flexShrink: 1 },
  buttons: { flexDirection: "row", gap: 12 },
  success: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A3D4B9",
    borderRadius: 12,
    backgroundColor: colors.successLight,
  },
  successLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.success,
    includeFontPadding: false,
  },
});
