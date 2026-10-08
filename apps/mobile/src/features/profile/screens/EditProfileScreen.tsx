import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { avatarSizes } from "@/constants/theme";
import {
  useAuthSession,
  useUpdateProfile,
  validateName,
} from "@/features/auth";
import { errorMessage } from "@/lib/http/errors";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileSection, profileStyles } from "../components/ProfilePrimitives";

export function EditProfileScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(session?.name ?? "");
  const [bio, setBio] = useState(session?.bio ?? "");
  const [headline, setHeadline] = useState(session?.headline ?? "");
  const [errors, setErrors] = useState<{
    name?: string;
    headline?: string;
    bio?: string;
  }>({});
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
    const nameError = validateName(name);
    if (nameError) next.name = nameError;
    if (headline.trim().length > 120)
      next.headline = "Tiêu đề không quá 120 ký tự.";
    if (bio.trim().length > 1000)
      next.bio = "Giới thiệu không quá 1.000 ký tự.";
    setErrors(next);
    if (Object.keys(next).length) return;
    Keyboard.dismiss();
    updateProfile.mutate(
      { fullName: name.trim(), headline: headline.trim(), bio: bio.trim() },
      { onSuccess: () => setSaved(true) },
    );
  };
  return (
    <ProfileLayout session={session} title="Chỉnh sửa hồ sơ" onBack={back}>
      {() => (
        <View style={styles.stack}>
          {saved && (
            <FormNotice tone="success">Hồ sơ đã được cập nhật.</FormNotice>
          )}
          {updateProfile.isError && (
            <FormNotice tone="error">
              {errorMessage(updateProfile.error)}
            </FormNotice>
          )}
          {Object.keys(errors).length > 0 && (
            <FormNotice tone="error">
              Kiểm tra lại các trường được đánh dấu.
            </FormNotice>
          )}
          <ProfileSection>
            <View style={styles.avatarRow}>
              <Avatar
                name={session.name}
                userId={session.userId}
                size={avatarSizes.edit}
                sourceUri={session.avatarUrl}
              />
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
          </ProfileSection>
          <ProfileSection style={{ gap: 16 }}>
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
              hint="Giới thiệu ngắn để người học hiểu bạn hơn."
            />
            <Input
              label="Vai trò / tiêu đề"
              value={headline}
              placeholder="Ví dụ: Frontend Developer"
              onChangeText={(value) => {
                setHeadline(value);
                setErrors((current) => ({ ...current, headline: undefined }));
                setSaved(false);
              }}
              error={errors.headline}
              maxLength={120}
            />
          </ProfileSection>
          <View style={styles.buttons}>
            <Button style={{ flex: 1 }} variant="secondary" onPress={back}>
              Hủy
            </Button>
            <Button
              style={{ flex: 1 }}
              onPress={save}
              disabled={saved || updateProfile.isPending}
            >
              {updateProfile.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </View>
          <InfoModal
            title={avatarNotice ? "Thay ảnh đại diện" : null}
            onClose={() => setAvatarNotice(false)}
          >
            Chọn ảnh từ thiết bị sẽ được bổ sung sau khi luồng quét ảnh đại diện
            sẵn sàng.
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
});
