import { Text, View, StyleSheet } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ProfileButton as Button } from "./ProfileButton";
import { FormNotice } from "@/components/FormNotice";
import { avatarSizes } from "@/constants/theme";
import type { AccountSession } from "@/features/auth";
import type { AvatarDraft } from "../utils/avatar-draft";
import { profileStyles } from "./ProfilePrimitives";
import { AvatarUploadNotice } from "./AvatarUploadNotice";

export function AvatarDraftEditor({
  session,
  draft,
  disabled,
  picking,
  error,
  onPick,
  onChange,
}: Readonly<{
  session: AccountSession;
  draft: AvatarDraft;
  disabled: boolean;
  picking: boolean;
  error: string | null;
  onPick: () => void;
  onChange: (draft: AvatarDraft) => void;
}>) {
  const sourceUri =
    draft?.kind === "upload"
      ? draft.image.uri
      : draft?.kind === "remove"
        ? null
        : session.avatarUrl;
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <Avatar
          name={session.name}
          userId={session.userId}
          size={avatarSizes.profile}
          sourceUri={sourceUri}
        />
        <View style={styles.actions}>
          <Button
            size="md"
            variant="secondary"
            disabled={disabled}
            onPress={onPick}
          >
            {picking ? "Đang chọn ảnh..." : "Thay ảnh đại diện"}
          </Button>
          <Text style={profileStyles.caption}>JPG, PNG, WebP. Tối đa 5MB.</Text>
          {draft ? (
            <Button
              variant="ghost"
              disabled={disabled}
              onPress={() => onChange(null)}
            >
              Bỏ thay đổi ảnh
            </Button>
          ) : (
            !!session.avatarUrl && (
              <Button
                variant="ghost"
                disabled={disabled}
                onPress={() => onChange({ kind: "remove" })}
              >
                Xóa ảnh đại diện
              </Button>
            )
          )}
        </View>
      </View>
      {draft && (
        <Text style={profileStyles.caption}>
          {draft.kind === "upload"
            ? "Ảnh mới sẽ được tải lên khi lưu."
            : "Ảnh đại diện sẽ được xóa khi lưu."}
        </Text>
      )}
      {!draft && !error && <AvatarUploadNotice />}
      {!!error && <FormNotice tone="error">{error}</FormNotice>}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 8,
  },
  actions: { gap: 8, flexShrink: 1 },
});
