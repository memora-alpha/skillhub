import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { iconSizes, typography, fonts } from "@/constants/theme";
import { discoveryColors as colors } from "../constants/theme";
import type { RequestDetailContent } from "../mocks/requestDetails";

function SkillSection({
  title,
  icon,
  text,
  tags,
  teaching = false,
}: {
  title: string;
  icon: IconName;
  text?: string;
  tags?: string[];
  teaching?: boolean;
}) {
  const tint = teaching ? colors.green : colors.orange;
  return (
    <View style={[styles.card, teaching && styles.teachingCard]}>
      <View style={styles.heading}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: teaching ? colors.greenSoft : colors.orangeSoft,
            },
          ]}
        >
          <Icon
            name={icon}
            size={iconSizes.control}
            color={tint}
            filled={false}
          />
        </View>
        <Text style={[styles.title, { color: tint }]}>{title}</Text>
      </View>
      <Text style={styles.body}>
        {text ?? "Nội dung chi tiết đang được cập nhật."}
      </Text>
      {!!tags?.length && (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.tag,
                teaching && { backgroundColor: colors.greenSoft },
              ]}
            >
              <Text
                style={[styles.tagText, teaching && { color: colors.green }]}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
export function RequestDetailSections({
  detail,
}: {
  detail?: RequestDetailContent;
}) {
  return (
    <>
      <SkillSection
        title="Tôi muốn học"
        icon="book"
        text={detail?.learning}
        tags={detail?.learningTags}
      />
      <SkillSection
        title="Tôi có thể dạy lại"
        icon="star"
        text={detail?.sharing}
        tags={detail?.sharingTags}
        teaching
      />
      <View style={styles.card}>
        <View style={styles.heading}>
          <View style={[styles.icon, { backgroundColor: colors.purpleSoft }]}>
            <Icon
              name="calendar"
              size={iconSizes.control}
              color={colors.purple}
            />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>Lịch rảnh</Text>
        </View>
        {detail ? (
          <>
            <View style={{ gap: 8 }}>
              {detail.schedule.map((row) => (
                <View key={row.day} style={styles.scheduleRow}>
                  <Text style={styles.weekDay}>{row.day}</Text>
                  <View style={styles.slots}>
                    {row.slots.map((slot) => (
                      <View key={slot} style={styles.slot}>
                        <Text style={styles.tagText}>{slot}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.note}>
              <Icon name="clock" size={iconSizes.inline} color={colors.muted} />
              <Text style={styles.caption}>{detail.scheduleNote}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.body}>Lịch rảnh đang được cập nhật.</Text>
        )}
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    boxShadow: "0 2px 8px rgba(53, 43, 31, 0.025)",
  },
  teachingCard: {
    backgroundColor: colors.sharing,
    borderColor: colors.greenSoft,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    includeFontPadding: false,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    borderRadius: 4,
    backgroundColor: colors.tag,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: fonts.medium,
    color: colors.body,
    ...typography.caption,
  },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekDay: {
    width: 58,
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  slots: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  slot: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.tag,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 4,
  },
  caption: {
    flex: 1,
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
});
