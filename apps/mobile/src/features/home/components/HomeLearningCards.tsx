import { Pressable, Text, View } from "react-native";
import { useIsFocused, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { learningRoutes } from "@/constants/navigation";
import { avatarSizes, iconSizes } from "@/constants/theme";
import { useParticipantProfile } from "@/features/connections";
import {
  canJoinSession,
  formatSessionTime,
  sessionPresentation,
} from "@/features/sessions";
import { homeColors as colors } from "../constants/theme";
import type { HomeData } from "../hooks/use-home-data";
import { HomeSection, SectionHeading, homeStyles } from "./HomePrimitives";
import { HomeReadFeedback } from "./HomeReadFeedback";
import { styles } from "./HomeContent.styles";

type Props = Readonly<{ data: HomeData; onNavigate: (href: Href) => void }>;

export function HomeSessionCard({ data, onNavigate }: Props) {
  const { sessions, path } = data;
  const item = sessions.item;
  const focused = useIsFocused();
  let partnerId: string | undefined;
  if (item)
    partnerId = item.role === "TEACHER" ? item.learnerId : item.teacherId;
  const partner = useParticipantProfile(partnerId, focused);
  const plan = path.item?.plans.find((plan) => plan.id === item?.planId);
  const sessionNo = plan?.sessions.find(
    (session) => session.id === item?.id,
  )?.sessionNo;
  const title =
    plan?.sessionOutline.find((outline) => outline.sessionNo === sessionNo)
      ?.content ||
    plan?.learningGoal ||
    "Buổi học tiếp theo";
  return (
    <LinearGradient
      colors={[colors.sessionStart, colors.sessionEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.session}
    >
      <View style={homeStyles.row}>
        <View style={styles.sessionStatus}>
          <Icon name="calendar" size={12} color={colors.orangeDark} />
          <Text style={styles.statusLabel}>
            {item ? sessionPresentation(item).label : "Buổi học tiếp theo"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem lịch học"
          onPress={() => onNavigate("/calendar")}
          hitSlop={8}
        >
          <Text style={homeStyles.link}>Lịch học</Text>
        </Pressable>
      </View>
      <HomeReadFeedback {...sessions} hasData={!!item} retry={sessions.refetch}>
        {item ? (
          <>
            <Text style={styles.sessionTitle}>{title}</Text>
            <View style={styles.partner}>
              <Avatar
                name={partner.data?.fullName ?? "Thành viên SkillHub"}
                userId={partnerId}
                sourceUri={partner.data?.avatarUrl}
                size={avatarSizes.compact}
              />
              <Text style={styles.mentorName}>
                {partner.data?.fullName ?? "Thành viên SkillHub"}
              </Text>
              <View style={styles.mentorBadge}>
                <Text style={styles.mentorBadgeLabel}>
                  {item.role === "TEACHER" ? "Bạn dạy" : "Bạn học"}
                </Text>
              </View>
            </View>
            <Text style={styles.sessionCaption}>
              {formatSessionTime(item.startAt)}
            </Text>
            <Text style={homeStyles.caption}>
              Kết thúc: {formatSessionTime(item.endAt)} · Giờ trên thiết bị
            </Text>
            <View style={styles.sessionFooter}>
              <Button
                size="sm"
                variant="white"
                onPress={() =>
                  onNavigate({
                    pathname: "/learning-sessions/[id]",
                    params: { id: item.id },
                  })
                }
              >
                Xem buổi học
              </Button>
              {canJoinSession(item) && (
                <Button
                  size="sm"
                  onPress={() =>
                    onNavigate({
                      pathname: "/learning-sessions/[id]/room",
                      params: { id: item.id },
                    })
                  }
                >
                  Vào học
                </Button>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sessionTitle}>
              Chưa có buổi học trong 30 ngày tới
            </Text>
            <Text style={styles.sessionCaption}>
              Khám phá kỹ năng hoặc xem lịch học để chuẩn bị buổi tiếp theo.
            </Text>
            <Button
              size="sm"
              variant="white"
              onPress={() => onNavigate("/discover")}
            >
              Khám phá kỹ năng
            </Button>
          </>
        )}
      </HomeReadFeedback>
      {sessions.limited && (
        <Text style={homeStyles.caption}>
          Đang xét 100 buổi đầu trong khoảng thời gian này. Xem lịch học để kiểm
          tra thêm.
        </Text>
      )}
    </LinearGradient>
  );
}

export function HomePathCard({ data, onNavigate }: Props) {
  const { path } = data;
  const item = path.item;
  return (
    <HomeSection>
      <SectionHeading
        title="Learning Path hiện tại"
        action="Tất cả"
        onPress={() => onNavigate(learningRoutes.paths)}
      />
      <HomeReadFeedback {...path} hasData={!!item} retry={path.refetch}>
        {item ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem Learning Path: ${path.title}`}
            onPress={() =>
              onNavigate({ pathname: "/paths/[id]", params: { id: item.id } })
            }
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
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={homeStyles.label} numberOfLines={2}>
                  {path.title}
                </Text>
                <Text style={homeStyles.caption}>
                  {path.completed}/{path.total} buổi hoàn tất trong Learning
                  Path
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.orange} />
            </View>
            {path.total > 0 && (
              <ProgressBar
                value={path.completed}
                max={path.total}
                color={colors.orange}
                trackColor={colors.track}
                height={6}
                label={path.title}
              />
            )}
          </Pressable>
        ) : (
          <View style={[styles.card, styles.course]}>
            <Text style={homeStyles.label}>
              Chưa tìm thấy Learning Path đang diễn ra
            </Text>
            <Text style={homeStyles.caption}>
              Các Learning Path đã lên lịch hoặc đang học sẽ xuất hiện ở đây.
            </Text>
          </View>
        )}
      </HomeReadFeedback>
    </HomeSection>
  );
}
