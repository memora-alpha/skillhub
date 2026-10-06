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
import { recentMessages } from "@/mocks/app";
import { colors, fonts, radius } from "@/constants/theme";
import {
  achievement,
  learningPath,
  matchingRequests,
  newUserSummary,
  nextSession,
  returningSummary,
} from "../mocks/home";
import { HomeSection, SectionHeading, homeStyles } from "./HomePrimitives";
import { NewUserGuide } from "./NewUserGuide";

export function HomeContent({
  name,
  isNew,
  onAction,
}: {
  name: string;
  isNew: boolean;
  onAction: (title: string) => void;
}) {
  const wide = useWindowDimensions().width >= 840;
  const summary = isNew ? newUserSummary : returningSummary;
  const achievementProgress = isNew ? 0 : achievement.completed;
  const messages = isNew ? [] : recentMessages;
  const stats = [
    {
      label: "Reputation",
      value: summary.reputation,
      color: colors.brand,
    },
    { label: "Đã học", value: summary.learned, color: colors.ink },
    { label: "Đã dạy", value: summary.taught, color: colors.ink },
  ];
  return (
    <View style={homeStyles.stack}>
      <View style={[homeStyles.row, { gap: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={homeStyles.body}>Chào bạn</Text>
          <Text style={homeStyles.title}>{name}!</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ví Credit"
          onPress={() => onAction("Ví Credit")}
          style={({ pressed }) => [styles.wallet, pressed && { opacity: 0.7 }]}
        >
          <Icon name="wallet" size={16} color={colors.brand} />
          <Text style={styles.credit}>{summary.credit} CR</Text>
        </Pressable>
      </View>
      {isNew && <NewUserGuide onAction={onAction} />}
      <View style={[styles.columns, wide && styles.wideColumns]}>
        <View style={[styles.primary, wide && styles.wideColumn]}>
          <View style={styles.session}>
            {isNew ? (
              <>
                <View style={styles.sessionStatus}>
                  <Icon name="clock" size={14} color={colors.brandHover} />
                  <Text style={styles.sessionCaption}>Buổi học tiếp theo</Text>
                </View>
                <Text style={styles.sessionTitle}>
                  Chưa có buổi học sắp tới
                </Text>
                <Text style={styles.sessionCaption}>
                  Tìm kỹ năng bạn muốn học và kết nối với người hướng dẫn.
                </Text>
                <View style={styles.sessionFooter}>
                  <Button
                    size="sm"
                    variant="white"
                    onPress={() => onAction("Khám phá")}
                  >
                    Khám phá kỹ năng
                  </Button>
                </View>
              </>
            ) : (
              <>
                <View style={styles.sessionStatus}>
                  <Icon name="clock" size={14} color={colors.brandHover} />
                  <Text style={styles.sessionCaption}>Sắp diễn ra</Text>
                </View>
                <Text style={styles.sessionTitle}>{nextSession.title}</Text>
                <View style={styles.partner}>
                  <Avatar name={nextSession.mentor} size={28} tone="accent" />
                  <Text style={[styles.sessionCaption, { flex: 1 }]}>
                    {nextSession.mentor}
                  </Text>
                </View>
                <View style={styles.sessionFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTime}>
                      {nextSession.schedule}
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    variant="white"
                    onPress={() => onAction("Vào học")}
                  >
                    Vào học
                  </Button>
                </View>
              </>
            )}
          </View>
          <HomeSection>
            <SectionHeading
              title="Lộ trình đang học"
              action={isNew ? "Khám phá" : "Chi tiết"}
              onPress={() => onAction(isNew ? "Khám phá" : "Lộ trình đang học")}
            />
            {isNew ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tìm lộ trình học"
                onPress={() => onAction("Khám phá")}
                style={({ pressed }) => [
                  styles.course,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[homeStyles.row, { gap: 12 }]}>
                  <View style={styles.courseIcon}>
                    <Icon name="book" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={homeStyles.label}>
                      Chưa có lộ trình đang học
                    </Text>
                    <Text style={homeStyles.caption}>
                      Tìm kỹ năng để bắt đầu buổi đầu tiên.
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={learningPath.title}
                onPress={() => onAction("Lộ trình đang học")}
                style={({ pressed }) => [
                  styles.course,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[homeStyles.row, { gap: 12, marginBottom: 16 }]}>
                  <View style={styles.courseIcon}>
                    <Icon name="book" size={20} color={colors.brand} />
                  </View>
                  <Text style={[homeStyles.label, { flex: 1 }]}>
                    {learningPath.title}
                  </Text>
                </View>
                <ProgressBar
                  value={learningPath.completed}
                  max={learningPath.total}
                  color={colors.brand}
                  label={learningPath.title}
                />
                <View style={[homeStyles.row, { gap: 8, marginTop: 10 }]}>
                  <Text style={[homeStyles.caption, { flex: 1 }]}>
                    Buổi tiếp: {learningPath.next}
                  </Text>
                  <Text style={homeStyles.caption}>
                    {learningPath.completed}/{learningPath.total} buổi
                  </Text>
                </View>
              </Pressable>
            )}
          </HomeSection>
          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={[homeStyles.caption, styles.statLabel]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
          <HomeSection>
            <SectionHeading
              title="Tiến trình huy hiệu"
              action="Xem tất cả"
              onPress={() => onAction("Tiến trình huy hiệu")}
            />
            <View style={styles.achievement}>
              <View style={styles.award}>
                <Icon name="award" size={24} color={colors.gold} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={homeStyles.label}>{achievement.title}</Text>
                <Text style={homeStyles.caption}>
                  {achievement.description} · {achievementProgress}/
                  {achievement.total} buổi
                </Text>
                <ProgressBar
                  value={achievementProgress}
                  max={achievement.total}
                  color={colors.gold}
                  label={achievement.title}
                />
              </View>
            </View>
          </HomeSection>
        </View>
        <View style={[styles.secondary, wide && styles.wideColumn]}>
          <HomeSection>
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
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[homeStyles.row, { gap: 12 }]}>
                    <View style={styles.match}>
                      <Text style={styles.matchLabel}>
                        {request.match}% phù hợp
                      </Text>
                    </View>
                    <Text style={styles.budget}>
                      {request.credit} CR/lộ trình
                    </Text>
                  </View>
                  <Text style={styles.requestTitle} numberOfLines={2}>
                    {request.title}
                  </Text>
                  <View style={styles.requestPerson}>
                    <Avatar name={request.name} size={24} />
                    <Text style={[homeStyles.caption, { flex: 1 }]}>
                      {request.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </HomeSection>
          <HomeSection>
            <SectionHeading
              title="Tin nhắn mới"
              action="Tất cả"
              onPress={() => onAction("Tin nhắn")}
            />
            <View style={{ gap: 16 }}>
              {messages.length === 0 && (
                <View style={styles.emptyMessages}>
                  <Icon name="message" size={24} color={colors.muted} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={homeStyles.label}>Chưa có tin nhắn mới</Text>
                    <Text style={homeStyles.caption}>
                      Các cuộc trò chuyện của bạn sẽ xuất hiện ở đây.
                    </Text>
                  </View>
                </View>
              )}
              {messages.map((message) => (
                <Pressable
                  key={message.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tin nhắn từ ${message.name}`}
                  onPress={() => onAction(message.name)}
                  style={({ pressed }) => [
                    styles.message,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Avatar name={message.name} />
                  <View style={{ flex: 1, gap: 3 }}>
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
          </HomeSection>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  columns: { gap: 28 },
  wideColumns: { flexDirection: "row", alignItems: "flex-start" },
  wideColumn: { flex: 1 },
  primary: { minWidth: 0, gap: 24 },
  secondary: { minWidth: 0, gap: 28 },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  credit: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  session: {
    padding: 20,
    gap: 14,
    borderRadius: radius.card,
    backgroundColor: colors.brandSurface,
  },
  sessionStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  sessionCaption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.body,
  },
  sessionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
  },
  partner: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  sessionTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.body,
  },
  course: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandLight,
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, minWidth: 0, gap: 4, alignItems: "center" },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    textAlign: "center",
  },
  statLabel: { textAlign: "center" },
  request: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  requestTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  requestPerson: { flexDirection: "row", alignItems: "center", gap: 8 },
  budget: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.brand,
    textAlign: "right",
  },
  match: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.badge,
    backgroundColor: colors.sageLight,
  },
  matchLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.sage,
  },
  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  emptyMessages: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  messageMeta: { alignItems: "flex-end", gap: 4 },
  time: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
  },
  unread: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
    color: colors.white,
  },
  achievement: { flexDirection: "row", alignItems: "center", gap: 12 },
  award: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    backgroundColor: colors.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
});
