import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function ProposalSendFrame({
  children,
  action,
}: Readonly<{ children: ReactNode; action: ReactNode }>) {
  return (
    <View style={styles.frame}>
      <KeyboardFormScrollView
        style={styles.frame}
        contentContainerStyle={styles.content}
      >
        {children}
      </KeyboardFormScrollView>
      <View style={styles.footer}>{action}</View>
    </View>
  );
}
export function ProposalSendContext({
  title,
  skill,
  name,
  userId,
  avatarUrl,
  direct,
}: Readonly<{
  title: string;
  skill: string;
  name: string;
  userId: string;
  avatarUrl?: string | null;
  direct: boolean;
}>) {
  return (
    <View style={styles.context}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.eyebrow}>
            {direct ? "Kết nối qua kỹ năng" : "Yêu cầu học"}
          </Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.skill}>{skill}</Text>
      </View>
      <View style={styles.recipient}>
        <Avatar name={name} userId={userId} sourceUri={avatarUrl} size={36} />
        <View style={styles.grow}>
          <Text style={styles.muted}>Gửi tới</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
        <Text style={styles.muted}>Học 1:1</Text>
      </View>
    </View>
  );
}
export function ProposalTypeChoice({
  value,
  oneWayLabel,
  disabled,
  onChange,
}: Readonly<{
  value?: string;
  oneWayLabel: string;
  disabled: boolean;
  onChange: (value: "ONE_WAY" | "TWO_WAY") => void;
}>) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.name}>Bạn muốn đề xuất gì?</Text>
      <View style={styles.row}>
        {(["TWO_WAY", "ONE_WAY"] as const).map((type) => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === type, disabled }}
            disabled={disabled}
            onPress={() => {
              if (!disabled) onChange(type);
            }}
            style={[styles.option, value === type && styles.selected]}
          >
            <View style={styles.row}>
              <Icon
                name={type === "TWO_WAY" ? "users" : "user"}
                size={18}
                color={value === type ? colors.primary : colors.muted}
              />
              <View style={styles.grow} />
              {value === type && (
                <Icon name="check-circle" size={16} color={colors.primary} />
              )}
            </View>
            <Text
              style={[styles.name, value === type && { color: colors.primary }]}
            >
              {type === "TWO_WAY" ? "Trao đổi" : oneWayLabel}
            </Text>
            <Text style={styles.muted}>
              {type === "TWO_WAY"
                ? "Cùng dạy và học từ nhau"
                : "Một người dạy, một người học"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function ProposalSafetyNote() {
  return (
    <View style={styles.notice}>
      <Icon name="shield" size={18} color={colors.forest} />
      <Text style={styles.noticeText}>
        Đồng ý đề xuất sẽ mở Chat. Hai bạn thống nhất lộ trình, lịch học và
        Credit sau.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: {
    gap: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  context: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  skill: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: 7,
    borderRadius: appRadius.button,
    maxWidth: "42%",
  },
  recipient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  name: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  muted: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  option: {
    flex: 1,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderRadius: appRadius.control,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  notice: {
    padding: 12,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: appRadius.control,
    backgroundColor: colors.forestSoft,
  },
  noticeText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.forest,
    flex: 1,
  },
});
