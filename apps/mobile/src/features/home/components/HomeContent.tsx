import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { recentMessages } from "@/mocks/app";
import { avatarSizes, iconSizes } from "@/constants/theme";
import { homeColors as colors } from "../constants/theme";
import {
  achievement,
  learningPath,
  matchingRequests,
  newUserSummary,
  nextSession,
  returningSummary,
} from "../mocks/home";
import { HomeSection, SectionHeading, homeStyles } from "./HomePrimitives";
import { styles } from "./HomeContent.styles";
import { NewUserGuide } from "./NewUserGuide";
import { HomeWalletBalance } from "@/features/wallet";

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
  const achievementPercent = Math.round(
    (achievementProgress / achievement.total) * 100,
  );
  const messages = isNew ? [] : recentMessages;
  const stats = [
    { label: "Reputation", value: summary.reputation, color: colors.orange },
    { label: "Đã học", value: summary.learned, color: colors.ink },
    { label: "Đã dạy", value: summary.taught, color: colors.ink },
  ];
  return (
    <View style={homeStyles.stack}>
      <View style={[homeStyles.row, { gap: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>CHÀO BẠN</Text>
          <Text style={homeStyles.title}>{name}!</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ví Credit"
          onPress={() => onAction("Ví Credit")}
          style={({ pressed }) => [
            styles.wallet,
            { maxWidth: "60%", flexShrink: 1 },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.walletIcon}>
            <Icon
              name="wallet"
              size={iconSizes.control}
              color={colors.orange}
            />
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={styles.walletLabel}>SỐ DƯ</Text>
            <HomeWalletBalance />
          </View>
        </Pressable>
      </View>
      {isNew && <NewUserGuide onAction={onAction} />}
      <View style={[styles.columns, wide && styles.wideColumns]}>
        <View style={[styles.primary, wide && styles.wideColumn]}>
          <LinearGradient
            colors={[colors.sessionStart, colors.sessionEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.session}
          >
            <View style={homeStyles.row}>
              <View style={styles.sessionStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusLabel}>
                  {isNew ? "Buổi học tiếp theo" : "Sắp diễn ra"}
                </Text>
              </View>
              {!isNew && (
                <View style={styles.meetingBadge}>
                  <Icon
                    name="video"
                    size={iconSizes.inline}
                    color={colors.body}
                  />
                  <Text style={styles.meetingLabel}>Google Meet</Text>
                </View>
              )}
            </View>
            <Text style={styles.sessionTitle}>
              {isNew ? "Chưa có buổi học sắp tới" : nextSession.title}
            </Text>
            {isNew ? (
              <Text style={styles.sessionCaption}>
                Tìm kỹ năng bạn muốn học và kết nối với người hướng dẫn.
              </Text>
            ) : (
              <View style={styles.partner}>
                <Avatar
                  name={nextSession.mentor}
                  userId={nextSession.mentorId}
                  size={avatarSizes.compact}
                  shape="circle"
                />
                <Text style={styles.mentorName}>{nextSession.mentor}</Text>
                <View style={styles.mentorBadge}>
                  <Text style={styles.mentorBadgeLabel}>Mentor</Text>
                </View>
              </View>
            )}
            <View style={styles.sessionFooter}>
              {!isNew && (
                <View style={styles.sessionSchedule}>
                  <Icon name="clock" size={14} color={colors.orangeDark} />
                  <Text style={styles.sessionTime}>{nextSession.schedule}</Text>
                </View>
              )}
              <Button
                size="sm"
                variant="white"
                style={styles.sessionButton}
                onPress={() => onAction(isNew ? "Khám phá" : "Vào học")}
              >
                <Text style={styles.sessionButtonLabel}>
                  {isNew ? "Khám phá kỹ năng" : "Vào học"}
                </Text>
                <Icon
                  name="arrow"
                  size={iconSizes.inline}
                  color={colors.orange}
                />
              </Button>
            </View>
          </LinearGradient>
          <HomeSection>
            <SectionHeading
              title="Lộ trình đang học"
              action={isNew ? "Khám phá" : "Chi tiết"}
              onPress={() => onAction(isNew ? "Khám phá" : "Lộ trình đang học")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isNew ? "Tìm lộ trình học" : learningPath.title
              }
              onPress={() => onAction(isNew ? "Khám phá" : "Lộ trình đang học")}
              style={({ pressed }) => [
                styles.card,
                styles.course,
                pressed && styles.pressed,
              ]}
            >
              <View style={[homeStyles.row, { gap: 10 }]}>
                <View style={styles.courseIcon}>
                  <Icon
                    name="book"
                    size={iconSizes.feature}
                    color={colors.orange}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={homeStyles.label}>
                    {isNew ? "Chưa có lộ trình đang học" : learningPath.title}
                  </Text>
                  <Text style={homeStyles.caption}>
                    {isNew
                      ? "Tìm kỹ năng để bắt đầu buổi đầu tiên."
                      : `Buổi tiếp: ${learningPath.next}`}
                  </Text>
                </View>
                {!isNew && (
                  <View style={styles.courseCount}>
                    <Text style={styles.courseCountLabel}>
                      {learningPath.completed}/{learningPath.total} buổi
                    </Text>
                  </View>
                )}
              </View>
              {!isNew && (
                <View style={styles.progress}>
                  <ProgressBar
                    value={learningPath.completed}
                    max={learningPath.total}
                    color={colors.orange}
                    trackColor={colors.track}
                    height={6}
                    label={learningPath.title}
                  />
                </View>
              )}
            </Pressable>
          </HomeSection>
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View key={stat.label} style={[styles.card, styles.stat]}>
                <View style={styles.statValueRow}>
                  {index === 0 && (
                    <Icon name="star" size={14} color={colors.yellow} />
                  )}
                  <Text style={[styles.statValue, { color: stat.color }]}>
                    {stat.value}
                  </Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <HomeSection>
            <SectionHeading
              title="Tiến trình huy hiệu"
              action="Xem tất cả"
              accent={colors.yellow}
              onPress={() => onAction("Tiến trình huy hiệu")}
            />
            <View style={[styles.card, styles.achievement]}>
              <View style={styles.award}>
                <Icon
                  name="award"
                  size={iconSizes.feature}
                  color={colors.yellow}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <View>
                  <View style={[homeStyles.row, { gap: 8 }]}>
                    <Text style={[homeStyles.label, { flex: 1 }]}>
                      {achievement.title}
                    </Text>
                    <Text style={styles.achievementPercent}>
                      {achievementPercent}%
                    </Text>
                  </View>
                  <Text style={homeStyles.caption}>
                    {achievement.description} · {achievementProgress}/
                    {achievement.total} buổi
                  </Text>
                </View>
                <View style={styles.progress}>
                  <ProgressBar
                    value={achievementProgress}
                    max={achievement.total}
                    color={colors.yellow}
                    trackColor={colors.track}
                    height={6}
                    label={achievement.title}
                  />
                </View>
              </View>
            </View>
          </HomeSection>
        </View>
        <View style={[styles.secondary, wide && styles.wideColumn]}>
          <HomeSection>
            <SectionHeading
              title="Yêu cầu học phù hợp"
              action="Xem thêm"
              accent={colors.green}
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
                    styles.card,
                    styles.request,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[homeStyles.row, { gap: 10 }]}>
                    <View style={styles.match}>
                      <Icon name="check" size={11} color={colors.green} />
                      <Text style={styles.matchLabel}>
                        {request.match}% phù hợp
                      </Text>
                    </View>
                    <View style={styles.budgetBadge}>
                      <Text style={styles.budget}>
                        {request.credit} CR/lộ trình
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestTitle} numberOfLines={2}>
                    {request.title}
                  </Text>
                  <View style={styles.requestPerson}>
                    <Avatar
                      name={request.name}
                      userId={request.userId}
                      size={avatarSizes.inline}
                      shape="circle"
                    />
                    <Text style={[homeStyles.caption, { flex: 1 }]}>
                      {request.name}
                    </Text>
                    <View style={styles.connectButton}>
                      <Text style={styles.connectLabel}>Xem chi tiết</Text>
                      <Icon
                        name="chevron"
                        size={iconSizes.inline}
                        color={colors.orange}
                      />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </HomeSection>
          <HomeSection>
            <SectionHeading
              title="Tin nhắn mới"
              action="Tất cả"
              accent={colors.blue}
              onPress={() => onAction("Tin nhắn")}
            />
            <View style={[styles.card, styles.messages]}>
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
              {messages.map((message, index) => (
                <Pressable
                  key={message.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tin nhắn từ ${message.name}`}
                  onPress={() => onAction(message.name)}
                  style={({ pressed }) => [
                    styles.message,
                    index > 0 && styles.messageDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.messageAvatar}>
                    <Avatar
                      name={message.name}
                      userId={message.userId}
                      size={avatarSizes.list}
                      shape="circle"
                    />
                    {index === 0 && <View style={styles.onlineDot} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={[homeStyles.row, { gap: 6 }]}>
                      <Text
                        style={[homeStyles.label, { flex: 1 }]}
                        numberOfLines={1}
                      >
                        {message.name}
                      </Text>
                      <Text style={styles.time}>{message.time}</Text>
                    </View>
                    <Text
                      style={[
                        homeStyles.caption,
                        message.unread > 0 && { color: colors.body },
                      ]}
                      numberOfLines={1}
                    >
                      {message.message}
                    </Text>
                  </View>
                  {message.unread > 0 && (
                    <View style={styles.unread}>
                      <Text style={styles.unreadLabel}>{message.unread}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </HomeSection>
        </View>
      </View>
    </View>
  );
}
