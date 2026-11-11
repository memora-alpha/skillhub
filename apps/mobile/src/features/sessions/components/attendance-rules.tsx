import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { LearningSession } from "../types";
import { formatSessionTime } from "../utils/session-time";

const cases = [
  [
    "Cả hai tham gia đủ thời lượng",
    "Xác nhận hoàn thành hoặc tự hoàn tất khi đủ điều kiện và hết hạn xác nhận.",
  ],
  [
    "Chỉ người dạy có mặt",
    "Người học −8 điểm uy tín; buổi được tính đã sử dụng.",
  ],
  ["Chỉ người học có mặt", "Người dạy −8 điểm uy tín; yêu cầu học bù."],
  ["Cả hai đều vắng", "Mỗi người −8 điểm uy tín; yêu cầu học bù."],
] as const;

function RuleGroup({
  title,
  first = false,
  children,
}: Readonly<{ title: string; first?: boolean; children: ReactNode }>) {
  return (
    <View style={[styles.group, !first && styles.divided]}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function RuleItem({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <View style={styles.item}>
      <View style={styles.dot} />
      <Text selectable style={styles.body}>
        {children}
      </Text>
    </View>
  );
}

export function AttendanceRules({
  session,
}: Readonly<{
  session: Pick<LearningSession, "originalStartAt" | "makeupQuota">;
}>) {
  const quota = session.makeupQuota;
  return (
    <View style={styles.rules}>
      <RuleGroup title="Đổi lịch" first>
        <RuleItem>Giữ nguyên thứ tự các buổi học.</RuleItem>
        <RuleItem>
          Buổi cuối được dời tối đa <Text style={styles.emphasis}>48 giờ</Text>{" "}
          từ lịch gốc.
        </RuleItem>
        {session.originalStartAt && (
          <Text selectable style={styles.note}>
            <Text style={styles.emphasis}>Lịch gốc: </Text>
            {formatSessionTime(session.originalStartAt)}
          </Text>
        )}
      </RuleGroup>

      <RuleGroup title="Học bù">
        <RuleItem>
          Mỗi buổi được học bù tối đa <Text style={styles.emphasis}>1 lần</Text>
          .
        </RuleItem>
        <RuleItem>
          Lượt dùng chung cả chiều dạy và học, tính cho người yêu cầu hủy hoặc
          người vắng.
        </RuleItem>
        <RuleItem>Hết lượt cần nhân sự hỗ trợ.</RuleItem>
        {quota && (
          <Text selectable style={styles.note}>
            <Text style={styles.emphasis}>Lượt của bạn: </Text>đã dùng{" "}
            {quota.used}/{quota.limit} lượt trong thỏa thuận.
          </Text>
        )}
      </RuleGroup>

      <RuleGroup title="Điểm danh và vắng học">
        <Text style={styles.body}>
          Kết quả áp dụng khi điểm danh đã chốt và không có tranh chấp.
        </Text>
        <View style={styles.cases}>
          {cases.map(([title, text], index) => (
            <View
              key={title}
              style={[styles.case, index > 0 && styles.caseDivider]}
            >
              <Text style={styles.caseTitle}>{title}</Text>
              <Text selectable style={styles.body}>
                {text}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.body}>
          Thiếu dữ liệu thì chờ xác minh, không tự kết luận vắng. Thời hạn xử lý
          hiển thị ở phần điểm danh.
        </Text>
      </RuleGroup>

      <RuleGroup title="Giải trình và hỗ trợ">
        <RuleItem>
          Giải trình được chấp nhận: học bù,{" "}
          <Text style={styles.emphasis}>không phạt uy tín</Text>.
        </RuleItem>
        <RuleItem>Cả hai vắng không được duyệt giải trình cho nhau.</RuleItem>
        <RuleItem>
          Sự cố kỹ thuật: chọn <Text style={styles.emphasis}>Báo sự cố</Text>.
        </RuleItem>
      </RuleGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 16 },
  group: { gap: 10 },
  divided: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 },
  heading: { fontFamily: fonts.bold, ...typography.body, color: colors.forest },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    marginTop: 7,
  },
  body: {
    flexShrink: 1,
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  emphasis: { fontFamily: fonts.bold },
  note: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
    padding: 10,
    borderRadius: appRadius.control,
    backgroundColor: colors.forestSoft,
  },
  cases: {
    paddingHorizontal: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  case: { gap: 4, paddingVertical: 12 },
  caseDivider: { borderTopWidth: 1, borderColor: colors.border },
  caseTitle: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.ink,
  },
});
