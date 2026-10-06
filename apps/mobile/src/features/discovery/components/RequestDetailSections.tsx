import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
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
  const tint = teaching ? colors.sage : colors.brand;
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: teaching ? colors.sageLight : colors.brandLight,
            },
          ]}
        >
          <Icon name={icon} size={14} color={tint} filled={false} />
        </View>
        <Text style={styles.title}>{title}</Text>
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
                teaching && { backgroundColor: colors.sageLight },
              ]}
            >
              <Text
                style={[styles.tagText, teaching && { color: colors.sage }]}
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
          <View style={[styles.icon, { backgroundColor: "#F0EBF9" }]}>
            <Icon name="calendar" size={14} color="#6B3DB5" />
          </View>
          <Text style={styles.title}>Lịch rảnh</Text>
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
            <Text style={styles.caption}>{detail.scheduleNote}</Text>
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22.75,
    color: colors.body,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    borderRadius: 6,
    backgroundColor: colors.sand,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fonts.medium,
    color: colors.body,
    fontSize: 12,
    lineHeight: 16,
  },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  weekDay: {
    width: 64,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
  },
  slots: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
});
