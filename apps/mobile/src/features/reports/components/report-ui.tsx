import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { reportStyles as s } from "./report.styles";
import {
  reportStatusLabel,
  reportStatusTone,
} from "../utils/report-presentation";
export function ReportPage({
  title,
  back = "/reports",
  selected = "Hồ sơ",
  children,
  refreshing,
  onRefresh,
}: Readonly<{
  title: string;
  back?: Href;
  selected?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <AppScreenLayout
      title={title}
      selected={selected}
      back={{ href: back, label: "Quay lại", behavior: "history" }}
      contentStyle={s.background}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={s.page}
          refreshing={refreshing}
          onRefresh={onRefresh}
        >
          {children}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
export function ReportSection({
  title,
  icon = "flag",
  action,
  accent = false,
  children,
}: Readonly<{
  title: string;
  icon?: IconName;
  action?: ReactNode;
  accent?: boolean;
  children: ReactNode;
}>) {
  return (
    <View style={[s.section, accent && s.accent]}>
      <View style={s.row}>
        <Icon name={icon} size={18} color={colors.forest} />
        <View style={s.grow}>
          <Text accessibilityRole="header" style={s.heading}>
            {title}
          </Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
export function ReportCopy({
  children,
  muted = false,
}: Readonly<{ children: ReactNode; muted?: boolean }>) {
  return (
    <Text selectable style={muted ? s.meta : s.body}>
      {children}
    </Text>
  );
}
export function ReportStatus({ status }: Readonly<{ status: string }>) {
  return (
    <Text style={[s.pill, reportStatusTone(status)]}>
      {reportStatusLabel(status)}
    </Text>
  );
}
export function ReportLink({
  title,
  href,
  icon = "chevron",
}: Readonly<{ title: string; href: Href; icon?: IconName }>) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      accessibilityLabel={title}
      onPress={() => router.push(href)}
      style={s.link}
    >
      <Icon name={icon} size={18} color={colors.forest} />
      <Text style={s.linkText}>{title}</Text>
      <Icon name="chevron" size={18} color={colors.muted} />
    </Button>
  );
}
