import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { policyScreenStyles as styles } from "./policies.styles";

const topics: Record<"terms" | "privacy", readonly [IconName, string][]> = {
  terms: [
    ["user", "Bảo vệ tài khoản, tôn trọng cộng đồng"],
    ["file", "Xác nhận trước khi bắt đầu học"],
    ["clock", "Tham gia, vắng học và khiếu nại"],
    ["wallet", "Khoản giữ, phí và hoàn Credit"],
    ["shield", "Hạn chế và cách gửi báo cáo"],
  ],
  privacy: [
    ["clipboard", "Thông tin cần cho hoạt động của app"],
    ["eye", "Phân biệt công khai và riêng tư"],
    ["video", "Camera, micro, ảnh và tệp"],
    ["lock", "Nhà cung cấp và bảo vệ thông tin"],
    ["settings", "Lựa chọn và quyền kiểm soát của bạn"],
  ],
};

const summaries = {
  terms: [
    [
      "Tài khoản & ứng xử",
      "Xác minh email, bảo vệ tài khoản và thông tin riêng tư. Không mạo danh, quấy rối, gian lận hoặc chia sẻ nội dung không có quyền sử dụng.",
    ],
    [
      "Thỏa thuận & lịch học",
      "Chấp nhận đề xuất chỉ mở trao đổi. Hai bên cần xác nhận kế hoạch, điều khoản và lịch; tin nhắn không thay thế các xác nhận này.",
    ],
    [
      "Điểm danh & học bù",
      "Điểm danh dựa trên thời gian kết nối phòng học. Vắng học, học bù và khiếu nại được xử lý theo kết quả và thời hạn hiển thị ở từng buổi.",
    ],
    [
      "Credit & tài liệu",
      "Credit được giữ và quyết toán theo thỏa thuận, với phí quyết toán hiện tại 4%. Chưa hỗ trợ rút Credit thành tiền; hoàn Credit có điều kiện, không tự động.",
    ],
    [
      "Uy tín & báo cáo",
      "Uy tín thấp có thể dẫn đến hạn chế tạo hoạt động mới. Xem thời hạn và xác nhận cần thiết tại mục Uy tín; tăng điểm không tự gỡ hạn chế. Báo cáo phải trung thực.",
    ],
  ],
  privacy: [
    [
      "Dữ liệu được sử dụng",
      "Thông tin tài khoản, hồ sơ, tin nhắn, tệp, lịch học, điểm danh và giao dịch phục vụ vận hành, bảo vệ tài khoản và xử lý tranh chấp.",
    ],
    [
      "Ai có thể xem",
      "Hồ sơ và nội dung công khai được hiển thị theo quyền. Tin nhắn, tệp riêng tư và thỏa thuận chỉ dành cho các bên có quyền; nhân sự được phân quyền có thể xem để xử lý vụ việc.",
    ],
    [
      "Quyền thiết bị",
      "Camera, micro, ảnh và tệp phục vụ chức năng bạn sử dụng. Có thể từ chối hoặc thu hồi quyền; chức năng tương ứng có thể bị giới hạn.",
    ],
    [
      "Dịch vụ & bảo vệ dữ liệu",
      "Dữ liệu cần thiết có thể được xử lý qua dịch vụ phòng học, thanh toán và lưu trữ. Không có cam kết mã hóa đầu cuối cho mọi nội dung.",
    ],
    [
      "Quản lý & xóa dữ liệu",
      "Bạn có thể cập nhật hồ sơ và quản lý phiên đăng nhập. Chưa có chức năng tự xóa toàn bộ tài khoản; thời hạn lưu giữ và đầu mối tiếp nhận yêu cầu dữ liệu chưa được công bố đầy đủ.",
    ],
  ],
} as const;

export function PolicySummary({
  type,
}: Readonly<{ type: "terms" | "privacy" }>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View style={styles.summary}>
      <Text style={styles.sectionLabel}>Những điều cần biết</Text>
      <View style={styles.topics}>
        {summaries[type].map(([title, body], index) => {
          const open = expanded === title;
          const [icon, hint] = topics[type][index]!;
          return (
            <View
              key={title}
              style={index < summaries[type].length - 1 && styles.topicDivider}
            >
              <Button
                variant="ghost"
                style={styles.topicButton}
                accessibilityLabel={title}
                accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? null : title)}
              >
                <View style={styles.topicIcon}>
                  <Icon name={icon} size={21} color={colors.body} />
                </View>
                <View style={styles.topicLabels}>
                  <Text style={styles.topicTitle}>{title}</Text>
                  {!open && <Text style={styles.topicHint}>{hint}</Text>}
                </View>
                <View style={open && styles.expandedChevron}>
                  <Icon name="chevron" size={17} color={colors.muted} />
                </View>
              </Button>
              {open && (
                <Text selectable style={styles.topicBody}>
                  {body}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
