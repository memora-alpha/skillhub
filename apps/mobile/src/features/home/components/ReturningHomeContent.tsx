import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { colors, fonts } from "@/constants/theme";
import {
  achievement,
  learningPath,
  matchingRequests,
  nextSession,
  recentMessages,
  returningSummary,
} from "../mocks/home";
import { HomeCard, SectionHeading, homeStyles } from "./HomePrimitives";

export function ReturningHomeContent({
  name,
  onAction,
}: {
  name: string;
  onAction: (title: string) => void;
}) {
  const compact = useWindowDimensions().width < 360;
  const stats = [
    {
      label: "Reputation",
      value: returningSummary.reputation,
      color: colors.brand,
    },
    {
      label: "Đã học",
      value: returningSummary.learned,
      sub: "buổi",
      color: colors.sage,
    },
    {
      label: "Đã dạy",
      value: returningSummary.taught,
      sub: "buổi",
      color: colors.gold,
    },
  ];
  return (
    <View style={homeStyles.stack}>
      <View style={homeStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={homeStyles.body}>Chào buổi tối 🌙</Text>
          <Text style={homeStyles.title}>{name}!</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={homeStyles.caption}>Credit</Text>
          <Text style={styles.credit}>{returningSummary.credit} CR</Text>
        </View>
      </View>
      <HomeCard style={{ borderLeftWidth: 4, borderLeftColor: colors.brand }}>
        <View style={[homeStyles.row, { alignItems: "flex-start", gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.warning}>
              <Icon name="clock" size={10} color={colors.warning} />
              <Text style={styles.warningLabel}>Sắp diễn ra</Text>
            </View>
            <Text style={styles.sessionTitle}>{nextSession.title}</Text>
            <Text style={[homeStyles.body, { marginTop: 2 }]}>
              Với {nextSession.mentor} · {nextSession.schedule}
            </Text>
          </View>
          <Button size="sm" onPress={() => onAction("Vào học")}>
            Vào học
          </Button>
        </View>
      </HomeCard>
      <HomeCard>
        <SectionHeading
          title="Lộ trình đang học"
          action="Chi tiết"
          onPress={() => onAction("Lộ trình đang học")}
        />
        <View style={{ gap: 4 }}>
          <View style={[homeStyles.row, { alignItems: "flex-start", gap: 8 }]}>
            <Text
              style={[homeStyles.label, { flex: 1, fontFamily: fonts.medium }]}
            >
              {learningPath.title}
            </Text>
            <Text style={homeStyles.link}>
              {learningPath.completed}/{learningPath.total} buổi
            </Text>
          </View>
          <ProgressBar
            value={learningPath.completed}
            max={learningPath.total}
            label={learningPath.title}
          />
          <Text style={homeStyles.caption}>Buổi tiếp: {learningPath.next}</Text>
        </View>
      </HomeCard>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <HomeCard
            key={stat.label}
            style={[styles.stat, compact && { padding: 12 }]}
          >
            <View style={{ flexDirection: "row" }}>
              <Text
                style={[
                  styles.statLabel,
                  compact && { fontSize: 10, letterSpacing: 0.2 },
                ]}
              >
                {stat.label.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: stat.color }]}>
              {stat.value}
            </Text>
            {stat.sub && (
              <Text style={[homeStyles.caption, { marginTop: 2 }]}>
                {stat.sub}
              </Text>
            )}
          </HomeCard>
        ))}
      </View>
      <View>
        <SectionHeading
          title="Yêu cầu học phù hợp"
          action="Xem thêm"
          onPress={() => onAction("Yêu cầu học phù hợp")}
        />
        <View style={{ gap: 12 }}>
          {matchingRequests.map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              accessibilityLabel={request.title}
              onPress={() => onAction(request.title)}
              style={({ pressed }) => [
                styles.request,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[homeStyles.label, { fontFamily: fonts.medium }]}
                  numberOfLines={1}
                >
                  {request.title}
                </Text>
                <Text style={[homeStyles.caption, { marginTop: 2 }]}>
                  {request.name} · {request.credit} CR/lộ trình
                </Text>
              </View>
              <View style={styles.match}>
                <Text style={styles.matchLabel}>{request.match}% phù hợp</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <HomeCard>
        <SectionHeading
          title="Tin nhắn mới"
          action="Tất cả"
          onPress={() => onAction("Tin nhắn")}
        />
        <View style={{ gap: 12 }}>
          {recentMessages.map((message) => (
            <Pressable
              key={message.id}
              accessibilityRole="button"
              accessibilityLabel={`Tin nhắn từ ${message.name}`}
              onPress={() => onAction(message.name)}
              style={({ pressed }) => [
                styles.message,
                pressed && { backgroundColor: colors.cream },
              ]}
            >
              <Avatar name={message.name} />
              <View style={{ flex: 1 }}>
                <Text style={homeStyles.label} numberOfLines={1}>
                  {message.name}
                </Text>
                <Text style={homeStyles.caption} numberOfLines={1}>
                  {message.message}
                </Text>
              </View>
              <View style={styles.messageMeta}>
                <Text style={styles.time}>{message.time}</Text>
                {message.unread > 0 && (
                  <View style={styles.unread}>
                    <Text style={styles.unreadLabel}>{message.unread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </HomeCard>
      <HomeCard>
        <SectionHeading
          title="Tiến trình huy hiệu"
          action="Xem tất cả"
          onPress={() => onAction("Tiến trình huy hiệu")}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={styles.award}>
            <Text style={{ fontSize: 24 }}>{achievement.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={homeStyles.label}>{achievement.title}</Text>
            <Text style={[homeStyles.caption, { marginBottom: 4 }]}>
              {achievement.description} · {achievement.completed}/
              {achievement.total} buổi
            </Text>
            <ProgressBar
              value={achievement.completed}
              max={achievement.total}
              color={colors.gold}
              label={achievement.title}
            />
          </View>
        </View>
      </HomeCard>
    </View>
  );
}
const styles = StyleSheet.create({
  credit: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.brand,
    includeFontPadding: false,
  },
  warning: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: colors.warningLight,
  },
  warningLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.warning,
    includeFontPadding: false,
  },
  sessionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.ink,
    marginTop: 8,
    includeFontPadding: false,
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, padding: 16, minWidth: 0 },
  statLabel: {
    flexShrink: 0,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.muted,
    includeFontPadding: false,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    marginTop: 4,
    includeFontPadding: false,
  },
  request: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  match: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: colors.sageLight,
  },
  matchLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.sage,
    includeFontPadding: false,
  },
  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  messageMeta: { alignItems: "flex-end", gap: 4 },
  time: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.mutedLight,
    includeFontPadding: false,
  },
  unread: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
    color: colors.white,
    includeFontPadding: false,
  },
  award: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
});
