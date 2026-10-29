import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";
import type { ChatFile } from "../utils/chat-file";
import { fileSizeLabel } from "./ChatFileCard";

export function ChatAttachmentTile({
  file,
  status,
  locked,
  onRemove,
}: Readonly<{
  file: ChatFile;
  status?: string;
  locked: boolean;
  onRemove: () => void;
}>) {
  const extension =
    /\.([a-z0-9]{1,10})$/i.exec(file.name)?.[1]?.toUpperCase() ?? "TỆP";
  return (
    <View style={styles.tile}>
      <View style={styles.icon}>
        <Icon
          name={/^(JPG|JPEG|PNG|WEBP)$/.test(extension) ? "image" : "file"}
          size={24}
          color={colors.brand}
        />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} ellipsizeMode="middle" style={styles.name}>
          {file.name}
        </Text>
        <Text style={styles.meta}>
          {extension} · {fileSizeLabel(file.file?.size ?? file.size ?? 0)}
        </Text>
        {!!status && (
          <Text accessibilityLiveRegion="polite" style={styles.meta}>
            {status}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bỏ tệp ${file.name}`}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={() => {
          if (!locked) onRemove();
        }}
        style={({ pressed }) => [
          styles.remove,
          pressed && styles.pressed,
          locked && styles.locked,
        ]}
      >
        <View style={styles.removeIcon}>
          <Icon name="close" size={14} color={colors.inkSoft} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 248,
    maxWidth: "100%",
    minWidth: 0,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingRight: 38,
    borderRadius: appRadius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.tag,
  },
  icon: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  meta: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  remove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  removeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
  locked: { opacity: 0.35 },
});
