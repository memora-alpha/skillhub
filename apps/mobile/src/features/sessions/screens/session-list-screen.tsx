import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import {
  SessionPage as FeaturePage,
  SessionEmptyState as EmptyState,
} from "../components/session-page";
import { sessionUi as ui } from "../components/session-page.styles";
import { FormNotice } from "@/components/FormNotice";
import { useSessionList } from "../hooks/use-sessions";
import {
  deviceTimezone,
  sessionRange,
  listIsLimited,
} from "../utils/session-time";
import { SessionCard } from "../components/session-card";
import { SessionFeedback } from "../components/session-feedback";

export function PathSessionsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [date, setDate] = useState(() => new Date());
  const timezone = deviceTimezone();
  const valid = z.uuid().safeParse(id).success;
  const query = useSessionList(
    sessionRange(date.getFullYear(), date.getMonth(), null, timezone),
    timezone,
    valid,
  );
  const sessions = query.data ?? [];
  const items = sessions.filter((s) => s.pathId === id);
  return (
    <FeaturePage
      title="Buổi học của lộ trình"
      demo={false}
      back="/calendar"
      backBehavior="history"
    >
      <View style={ui.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          style={ui.monthArrow}
          onPress={() =>
            setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
          }
        >
          <View style={ui.previousArrow}>
            <Icon name="chevron" size={18} color={colors.ink} />
          </View>
        </Pressable>
        <Text accessibilityRole="header" style={ui.monthTitle}>
          Tháng {date.getMonth() + 1}/{date.getFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          style={ui.monthArrow}
          onPress={() =>
            setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))
          }
        >
          <Icon name="chevron" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <SessionFeedback
        {...query}
        invalid={!valid}
        refreshing={query.isFetching}
        retry={() => query.refetch()}
      >
        {listIsLimited(sessions) && (
          <FormNotice tone="info">
            Tháng này đang hiển thị tối đa 100 buổi. Dữ liệu có thể chưa đầy đủ.
          </FormNotice>
        )}
        {items.map((s) => (
          <SessionCard key={s.id} session={s} timezone={timezone} />
        ))}
        {!items.length && (
          <EmptyState
            title="Chưa có buổi học trong tháng này"
            description="Chọn tháng khác hoặc tải lại lịch."
          />
        )}
      </SessionFeedback>
    </FeaturePage>
  );
}
