import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Host, Switch } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { appColors as colors } from "@/constants/theme";
import { SettingsPage } from "../components/SettingsPage";
import {
  SettingsIntro,
  SettingsSection,
  SettingsNote,
  SettingsSaveButton,
  settingsStyles,
} from "../components/SettingsUI";
import { errorMessage } from "@/lib/http/errors";
import { useToast } from "@/providers/ToastProvider";
import type { NotificationPreferences } from "../api/notification-preferences-api";
import { useNotificationPreferences } from "../hooks/use-notification-preferences";

const groups = [
  {
    key: "learning",
    label: "Học tập",
    description: "Yêu cầu học, đề xuất, tin nhắn và lịch buổi học.",
  },
  {
    key: "credit",
    label: "Credit",
    description: "Thanh toán, quyết toán và giao dịch Credit.",
  },
  {
    key: "community",
    label: "Cộng đồng",
    description: "Kỹ năng, tài liệu, thành tích và hoạt động cộng đồng.",
  },
] as const;

export function NotificationSettingsScreen() {
  const { query, mutation, isCurrent } = useNotificationPreferences();
  const [draft, setDraft] = useState<Partial<NotificationPreferences>>({});
  const focused = useRef(false);
  const flight = useRef(false);
  const { showToast } = useToast();
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  const data = query.data;
  const patch: Partial<NotificationPreferences> = {};
  for (const { key } of groups) {
    if (data && draft[key] !== undefined && draft[key] !== data[key])
      patch[key] = draft[key];
  }
  const save = async () => {
    if (
      flight.current ||
      query.isFetching ||
      query.isError ||
      !data ||
      !Object.keys(patch).length
    )
      return;
    flight.current = true;
    try {
      await mutation.mutateAsync(patch);
      if (!isCurrent()) return;
      setDraft({});
      if (focused.current) showToast("Đã lưu tùy chọn thông báo.", "success");
    } catch {
      // Keep the draft; the next explicit Save is the only retry.
    } finally {
      flight.current = false;
    }
  };
  const disabled = mutation.isPending || query.isFetching || query.isError;
  return (
    <SettingsPage
      title="Thông báo"
      footer={
        <SettingsSaveButton
          pending={mutation.isPending}
          disabled={disabled || !Object.keys(patch).length}
          onPress={() => {
            void save();
          }}
        />
      }
    >
      <SettingsIntro
        title="Nhận điều bạn quan tâm"
        description="Chọn các cập nhật về học tập, Credit và cộng đồng."
      />
      {query.isLoading && (
        <LoadingIndicator accessibilityLabel="Đang tải tùy chọn thông báo" />
      )}
      {query.isError && (
        <FormNotice tone="error">{errorMessage(query.error)}</FormNotice>
      )}
      <Button
        variant="ghost"
        leadingIcon="refresh"
        style={settingsStyles.inlineAction}
        disabled={query.isFetching || mutation.isPending}
        onPress={() => {
          mutation.reset();
          void query.refetch();
        }}
      >
        {query.isFetching ? "Đang cập nhật..." : "Tải lại tùy chọn đã lưu"}
      </Button>
      {data && (
        <SettingsSection title="Tùy chọn nhận thông báo">
          {groups.map(({ key, label, description }) => (
            <View key={key} style={styles.preference}>
              <Host
                matchContents={{ vertical: true }}
                style={settingsStyles.nativeControl}
                seedColor={colors.primary}
              >
                <Switch
                  key={key}
                  label={label}
                  value={draft[key] ?? data[key]}
                  disabled={disabled}
                  onValueChange={(value) => {
                    if (flight.current) return;
                    setDraft((current) => ({ ...current, [key]: value }));
                    mutation.reset();
                  }}
                />
              </Host>
              <Text style={settingsStyles.caption}>{description}</Text>
            </View>
          ))}
        </SettingsSection>
      )}
      {mutation.isError && (
        <FormNotice tone="error">
          Chưa xác nhận được kết quả lưu. {errorMessage(mutation.error)} Bản
          nháp vẫn được giữ. Tải lại để kiểm tra trước khi lưu lại.
        </FormNotice>
      )}
      <SettingsNote>
        Thông báo xác thực và bảo mật luôn được gửi để bảo vệ tài khoản của bạn.
      </SettingsNote>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ preference: { padding: 18, gap: 8 } });
