import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { uiLabel } from "@/constants/ui-copy";
import { reportDescriptionText } from "@/constants/system-text";
import type { UserReport } from "../api/reports-api";
import { reportDate, reportReasonIcon } from "../utils/report-presentation";
import { ReportStatus } from "./report-ui";
import { reportStyles as s } from "./report.styles";
export function ReportCard({ report }: Readonly<{ report: UserReport }>) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem báo cáo: ${uiLabel(report.reasonCode)}`}
      onPress={() => router.push(`/reports/${report.id}`)}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}
    >
      <View style={s.row}>
        <View style={s.sectionIcon}>
          <Icon
            name={reportReasonIcon(report.reasonCode)}
            size={18}
            color={colors.forest}
          />
        </View>
        <View style={s.grow}>
          <Text style={s.label}>
            {report.targetType === "SESSION" ? "Buổi học" : "Tài liệu"}
          </Text>
        </View>
        <ReportStatus status={report.status} />
      </View>
      <Text style={s.heading}>{uiLabel(report.reasonCode)}</Text>
      <Text numberOfLines={2} style={s.meta}>
        {reportDescriptionText(report.description)}
      </Text>
      <View style={s.cardFooter}>
        <Text style={s.meta}>{reportDate(report.createdAt)}</Text>
        <Icon name="chevron" size={18} color={colors.forest} />
      </View>
    </Pressable>
  );
}
