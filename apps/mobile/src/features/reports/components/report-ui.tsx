import { useEffect, useRef, useState, type ReactNode } from "react";
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
  onRefresh,
}: Readonly<{
  title: string;
  back?: Href;
  selected?: string;
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
}>) {
  const [refreshing, setRefreshing] = useState(false);
  const pulling = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function refresh() {
    if (pulling.current || !onRefresh) return;
    pulling.current = true;
    setRefreshing(true);
    void Promise.resolve()
      .then(onRefresh)
      .catch(() => {})
      .finally(() => {
        pulling.current = false;
        if (mounted.current) setRefreshing(false);
      });
  }
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
          onRefresh={onRefresh ? refresh : undefined}
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
  compact = false,
  subtitle,
  children,
}: Readonly<{
  title: string;
  icon?: IconName;
  action?: ReactNode;
  accent?: boolean;
  compact?: boolean;
  subtitle?: string;
  children: ReactNode;
}>) {
  return (
    <View style={[s.section, accent && s.accent, compact && s.compactSection]}>
      <View style={s.row}>
        <Icon name={icon} size={18} color={colors.forest} />
        <View style={s.grow}>
          <Text accessibilityRole="header" style={s.heading}>
            {title}
          </Text>
          {subtitle && <Text style={s.caption}>{subtitle}</Text>}
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
