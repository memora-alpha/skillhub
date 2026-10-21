import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ProfileButton as Button } from "../components/ProfileButton";
import { ControlledInput } from "@/components/ControlledInput";
import { FormNotice } from "@/components/FormNotice";
import {
  useAuthSession,
  useUpdateProfile,
  useSaveAvatar,
  type AccountSession,
} from "@/features/auth";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileSection, profileStyles } from "../components/ProfilePrimitives";
import { AvatarDraftEditor } from "../components/AvatarDraftEditor";
import {
  avatarImage,
  avatarFormData,
  AvatarSelectionError,
  type AvatarDraft,
} from "../utils/avatar-draft";
import { avatarSaveErrorMessage } from "../utils/avatar-save-error";
import {
  profileHasChanges,
  validateProfileDraft,
} from "../utils/profile-validation";
import type { ProfileDraft } from "../types/profile";
import { profileSaveErrorMessage } from "../utils/profile-save-error";

const profileFormSchema = z
  .object({
    fullName: z.string().trim(),
    headline: z.string(),
    bio: z.string(),
  })
  .superRefine((draft, context) => {
    for (const [field, message] of Object.entries(validateProfileDraft(draft)))
      context.addIssue({ code: "custom", path: [field], message });
  });

export function EditProfileScreen() {
  const { session, runtime } = useAuthSession();
  if (!session) return <Redirect href="/login" />;
  return <ProfileForm key={runtime.controller.generation} session={session} />;
}

function ProfileForm({ session }: { session: AccountSession }) {
  const router = useRouter();
  const { runtime } = useAuthSession();
  const updateProfile = useUpdateProfile();
  const saveAvatar = useSaveAvatar();
  const { showToast, dismissToast } = useToast();
  const focused = useRef(false);
  const saving = useRef(false);
  const selecting = useRef(false);
  const [initial, setInitial] = useState<ProfileDraft>(() => ({
    fullName: session.name,
    headline: session.headline,
    bio: session.bio,
  }));
  const form = useForm<ProfileDraft>({
    ...formValidationOptions,
    resolver: zodResolver(profileFormSchema),
    defaultValues: initial,
  });
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>(null);
  const [picking, setPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const submitting =
    updateProfile.isPending ||
    saveAvatar.isPending ||
    form.formState.isSubmitting;
  const pending = submitting || picking;
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const subscription =
        Platform.OS === "android"
          ? BackHandler.addEventListener(
              "hardwareBackPress",
              () => saving.current || selecting.current || pending,
            )
          : null;
      return () => {
        focused.current = false;
        subscription?.remove();
      };
    }, [pending]),
  );
  const changed = profileHasChanges(initial, form.watch()) || !!avatarDraft;
  const back = () => {
    if (!saving.current && !selecting.current && !pending)
      router.dismissTo("/profile");
  };
  const changeAvatar = (draft: AvatarDraft) => {
    setAvatarDraft(draft);
    setPickerError(null);
    saveAvatar.reset();
  };
  const pickAvatar = async () => {
    if (saving.current || selecting.current || pending) return;
    selecting.current = true;
    setPicking(true);
    setPickerError(null);
    const generation = runtime.controller.generation;
    const isCurrent = () =>
      focused.current && generation === runtime.controller.generation;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && isCurrent()) {
        const asset = result.assets[0];
        if (!asset)
          throw new AvatarSelectionError(
            "Không đọc được ảnh đã chọn. Hãy chọn lại.",
          );
        const image = avatarImage(asset);
        if (Platform.OS === "web" && !image.file)
          throw new AvatarSelectionError(
            "Không đọc được ảnh đã chọn. Hãy chọn lại.",
          );
        changeAvatar({ kind: "upload", image });
      }
    } catch (error) {
      if (isCurrent())
        setPickerError(
          error instanceof AvatarSelectionError
            ? error.message
            : "Không mở được thư viện ảnh. Hãy thử lại.",
        );
    } finally {
      selecting.current = false;
      if (isCurrent()) setPicking(false);
    }
  };
  const save = form.handleSubmit(async (values) => {
    if (
      saving.current ||
      selecting.current ||
      (!profileHasChanges(initial, values) && !avatarDraft)
    )
      return;
    saving.current = true;
    const generation = runtime.controller.generation;
    const isCurrent = () =>
      focused.current && generation === runtime.controller.generation;
    dismissToast();
    Keyboard.dismiss();
    setProfileSaved(false);
    try {
      if (profileHasChanges(initial, values)) {
        await updateProfile.mutateAsync(values);
        if (!isCurrent()) return;
        setInitial(values);
        setProfileSaved(true);
      }
      const upload = avatarDraft
        ? await saveAvatar.mutateAsync(
            avatarDraft.kind === "upload"
              ? avatarFormData(avatarDraft.image)
              : null,
          )
        : null;
      if (isCurrent()) {
        setAvatarDraft(null);
        showToast(
          upload ? "Ảnh đã tải lên, đang kiểm tra." : "Hồ sơ đã được cập nhật.",
          upload ? "info" : "success",
        );
        router.dismissTo("/profile");
      }
    } catch {
      // The mutation keeps the error and draft; an old screen must not show a toast.
    } finally {
      saving.current = false;
    }
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
          <AvatarDraftEditor
            session={session}
            draft={avatarDraft}
            disabled={pending}
            picking={picking}
            error={pickerError}
            onPick={() => {
              void pickAvatar();
            }}
            onChange={changeAvatar}
          />
          <ProfileSection style={styles.fields}>
            <Text accessibilityRole="header" style={profileStyles.heading}>
              Thông tin cơ bản
            </Text>
            <ControlledInput
              control={form.control}
              name="fullName"
              label="Tên hiển thị"
              editable={!pending}
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
              editable={!pending}
              onChangeText={updateProfile.reset}
              hint="Không bắt buộc. Tối đa 120 ký tự."
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus("bio")}
            />
            <ControlledInput
              control={form.control}
              name="bio"
              label="Giới thiệu bản thân"
              editable={!pending}
              onChangeText={updateProfile.reset}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              hint="Không bắt buộc. Tối đa 1.000 ký tự."
            />
          </ProfileSection>
          {updateProfile.isError && (
            <FormNotice tone="error">
              {profileSaveErrorMessage(updateProfile.error)}
            </FormNotice>
          )}
          {saveAvatar.isError && (
            <FormNotice tone="error">
              {profileSaved ? "Thông tin hồ sơ đã lưu. " : ""}
              {avatarSaveErrorMessage(saveAvatar.error)}
            </FormNotice>
          )}
          <View style={styles.buttons}>
            <Button
              size="lg"
              style={{ flex: 1 }}
              variant="secondary"
              onPress={back}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button
              size="lg"
              style={{ flex: 1 }}
              onPress={save}
              disabled={pending || !changed}
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </View>
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
  buttons: { flexDirection: "row", gap: 12 },
});
