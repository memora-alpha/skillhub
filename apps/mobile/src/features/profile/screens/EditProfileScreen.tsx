import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { InfoModal } from "@/components/InfoModal";
import { avatarSizes } from "@/constants/theme";
import { useAuthSession, useUpdateProfile } from "@/features/auth";
import {
  profileEditSchema,
  type ProfileEditFormValues,
} from "@/features/account";
import { errorMessage } from "@/lib/http/errors";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileSection, profileStyles } from "../components/ProfilePrimitives";

export function EditProfileScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const updateProfile = useUpdateProfile();
  const { showToast, dismissToast } = useToast();
  const form = useForm<ProfileEditFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      fullName: session?.name ?? "",
      headline: session?.headline ?? "",
      bio: session?.bio ?? "",
    },
  });
  const [avatarNotice, setAvatarNotice] = useState(false);
  if (!session) return <Redirect href="/login" />;
  const back = () => {
    if (!updateProfile.isPending) router.dismissTo("/profile");
  };
  const save = form.handleSubmit((values) => {
    if (updateProfile.isPending) return;
    dismissToast();
    Keyboard.dismiss();
    updateProfile.mutate(values, {
      onSuccess: () => {
        showToast("Hồ sơ đã được cập nhật.", "success");
        router.dismissTo("/profile");
      },
      onError: (error) => showToast(errorMessage(error), "error"),
    });
  });
  return (
    <ProfileLayout
      session={session}
      title="Chỉnh sửa hồ sơ"
      onBack={back}
      keyboardAware
    >
      {() => (
        <View style={styles.stack}>
          <View style={styles.avatarRow}>
            <Avatar
              name={session.name}
              userId={session.userId}
              size={avatarSizes.profile}
              sourceUri={session.avatarUrl}
            />
            <View style={styles.avatarActions}>
              <Button
                size="md"
                variant="secondary"
                disabled={updateProfile.isPending}
                onPress={() => setAvatarNotice(true)}
              >
                Thay ảnh đại diện
              </Button>
              <Text style={profileStyles.caption}>JPG, PNG. Tối đa 5MB.</Text>
            </View>
          </View>
          <ProfileSection style={styles.fields}>
            <Text accessibilityRole="header" style={profileStyles.heading}>
              Thông tin cơ bản
            </Text>
            <ControlledInput
              control={form.control}
              name="fullName"
              label="Tên hiển thị"
              editable={!updateProfile.isPending}
              onChangeText={updateProfile.reset}
              required
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus("headline")}
            />
            <ControlledInput
              control={form.control}
              name="headline"
              label="Vai trò / tiêu đề"
              placeholder="Ví dụ: Frontend Developer"
              editable={!updateProfile.isPending}
              onChangeText={updateProfile.reset}
              maxLength={120}
              hint="Không bắt buộc. Tối đa 120 ký tự."
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus("bio")}
            />
            <ControlledInput
              control={form.control}
              name="bio"
              label="Giới thiệu bản thân"
              editable={!updateProfile.isPending}
              onChangeText={updateProfile.reset}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              hint="Không bắt buộc. Tối đa 1.000 ký tự."
            />
          </ProfileSection>
          <View style={styles.buttons}>
            <Button
              size="lg"
              style={{ flex: 1 }}
              variant="secondary"
              onPress={back}
              disabled={updateProfile.isPending}
            >
              Hủy
            </Button>
            <Button
              size="lg"
              style={{ flex: 1 }}
              onPress={save}
              disabled={updateProfile.isPending}
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
  stack: {
    gap: 20,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingVertical: 12,
  },
  fields: { gap: 12 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 8,
  },
  avatarActions: { gap: 8, flexShrink: 1 },
  buttons: { flexDirection: "row", gap: 12 },
});
