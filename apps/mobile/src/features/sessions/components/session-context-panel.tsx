import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors } from "@/constants/theme";
import { useSessionContext } from "../hooks/use-session-context";
import type { LearningSession } from "../types";
import { SessionCopy, SessionButton } from "./session-page";
import { SessionSection } from "./session-section";
import { SessionLessonContent } from "./session-lesson-content";
import { sectionStyles as styles } from "./session-section.styles";

export function SessionContextPanel({
  session,
}: Readonly<{ session: LearningSession }>) {
  const query = useSessionContext(session),
    context = query.context;
  const router = useRouter();
  const progress = session.progress;
  return (
    <SessionSection
      title={progress ? "Tiến độ học tập" : "Nội dung buổi học"}
      icon="book"
      action={
        context && (
          <Button
            variant="ghost"
            accessibilityLabel="Xem lộ trình"
            style={styles.headerAction}
            onPress={() =>
              router.push(`/paths/${context.path.id}/plans/${context.plan.id}`)
            }
          >
            <Icon name="chevron" size={18} color={colors.forest} />
          </Button>
        )
      }
    >
      {progress && (
        <View style={styles.progressSummary}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressCaption}>Đã hoàn thành</Text>
            <Text selectable style={styles.progressValue}>
              {progress.plan.completed}/{progress.plan.total}
              <Text style={styles.progressUnit}> buổi</Text>
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Tiến độ lộ trình kỹ năng"
            aria-valuemin={0}
            aria-valuemax={progress.plan.total}
            aria-valuenow={progress.plan.completed}
            aria-valuetext={`${progress.plan.completed}/${progress.plan.total} buổi hoàn thành`}
            accessibilityValue={{
              min: 0,
              max: progress.plan.total,
              now: progress.plan.completed,
              text: `${progress.plan.completed}/${progress.plan.total} buổi hoàn thành`,
            }}
            style={styles.progressTrack}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress.plan.total ? (progress.plan.completed / progress.plan.total) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          {(progress.agreement.completed !== progress.plan.completed ||
            progress.agreement.total !== progress.plan.total) && (
            <Text selectable style={styles.progressCaption}>
              Toàn thỏa thuận · {progress.agreement.completed}/
              {progress.agreement.total} buổi hoàn thành
            </Text>
          )}
        </View>
      )}
      <View style={[styles.content, progress && styles.divider]}>
        {progress && (
          <View style={styles.lessonHeading}>
            {context && (
              <View style={styles.lessonBadge}>
                <Text style={styles.lessonBadgeText}>
                  Buổi {context.outline.sessionNo}
                </Text>
              </View>
            )}
            <Text accessibilityRole="header" style={styles.contentHeading}>
              Nội dung buổi học
            </Text>
          </View>
        )}
        {context ? (
          <>
            {!progress && (
              <Text style={styles.caption}>
                Buổi {context.outline.sessionNo}
              </Text>
            )}
            <SessionLessonContent
              key={`${context.plan.id}:${context.plan.version}:${context.outline.sessionNo}`}
              content={context.outline.content}
            />
          </>
        ) : !query.error ? (
          <SessionCopy muted>
            {query.isLoading
              ? "Đang tải nội dung buổi học…"
              : "Chưa có nội dung buổi học."}
          </SessionCopy>
        ) : null}
        {!!query.error && (
          <FormNotice compact tone="error">
            Chưa cập nhật được nội dung. Bạn vẫn có thể xem thông tin buổi học.
          </FormNotice>
        )}
        {(!context || !!query.error) && !query.isLoading && (
          <SessionButton
            variant="paper"
            disabled={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            Tải lại nội dung
          </SessionButton>
        )}
      </View>
    </SessionSection>
  );
}
