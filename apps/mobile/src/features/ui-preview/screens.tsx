import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { ConnectionScreen } from "@/components/ConnectionScreen";
import { useLocalSearchParams } from "expo-router";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
const groups = [
  {
    title: "Bắt đầu & khám phá",
    items: [
      ["Hướng dẫn người mới", "/onboarding"],
      ["Khám phá khi chưa đăng nhập", "/explore"],
      ["Tìm người chia sẻ / yêu cầu", "/search"],
      ["Thông báo", "/notifications"],
    ],
  },
  {
    title: "Kỹ năng & bằng chứng",
    items: [
      ["Kỹ năng của tôi", "/my-skills"],
      ["Thêm kỹ năng", "/my-skills/new"],
    ],
  },
  {
    title: "Yêu cầu & đề xuất",
    items: [
      ["Yêu cầu của tôi", "/requests"],
      ["Tạo yêu cầu", "/requests/new"],
      ["Kết quả kiểm duyệt từ chối", "/requests/request-rejected"],
      ["Yêu cầu đã khớp", "/requests/request-matched"],
      ["Hộp đề xuất", "/proposals"],
      ["Cuộc trao đổi", "/messages"],
    ],
  },
  {
    title: "Lộ trình & lịch học",
    items: [
      ["Tất cả lộ trình", "/paths"],
      ["Chọn hình thức / vai trò / Credit", "/agreement-type"],
      ["Thương lượng hai chiều", "/paths/path-draft"],
      ["Đủ xác nhận hai chiều", "/paths/path-ready"],
      ["Đủ xác nhận một chiều", "/paths/path-one-way-ready"],
      ["Chờ xác nhận kế hoạch", "/paths/path-pending-plan"],
      ["Giữ Credit bị chặn: thiếu số dư", "/paths/path-no-credit/hold"],
      ["Giữ Credit bị chặn: trùng lịch", "/paths/path-conflict/hold"],
      ["Lịch theo từng kế hoạch", "/paths/path-ready/schedules"],
      ["Kiểm tra & giữ Credit", "/paths/path-ready/hold"],
      ["Lộ trình một chiều đang học", "/paths/path-active"],
      ["Tranh chấp giữ quyết toán", "/paths/path-disputed"],
      ["Hủy trước khi giữ Credit", "/paths/path-draft/cancel"],
      ["Dừng sau khi đã giữ Credit", "/paths/path-active/cancel"],
      ["Quyết toán một chiều", "/paths/path-completed/settlement"],
      ["Quyết toán hai chiều", "/paths/path-completed-two-way/settlement"],
    ],
  },
  {
    title: "Buổi học & LiveKit",
    items: [
      ["Buổi đã kết thúc", "/learning-sessions/active-react-0"],
      ["Xác nhận hoàn thành", "/learning-sessions/active-react-0"],
      ["Đổi lịch", "/learning-sessions/active-react-1/reschedule"],
      ["Nhận đề nghị đổi lịch", "/learning-sessions/active-react-1"],
      [
        "Chờ người trao đổi xác nhận hoàn thành",
        "/learning-sessions/awaiting-ux-0",
      ],
      ["Phòng chờ / phòng mẫu", "/learning-sessions/active-react-1/room"],
    ],
  },
  {
    title: "Tài liệu",
    items: [
      ["Khám phá tài liệu", "/materials"],
      ["Tài liệu miễn phí", "/materials/react-guide"],
      ["Xác nhận giá & phiên bản", "/materials/ux-workbook/purchase?changed=1"],
      ["Thư viện có quyền mẫu", "/materials/library"],
      ["Đăng tài liệu", "/materials/new"],
      ["Tài liệu tôi chia sẻ", "/materials/mine"],
    ],
  },
  {
    title: "Cộng đồng & hỗ trợ",
    items: [
      ["Đánh giá cuối lộ trình", "/paths/path-completed/review"],
      ["Đánh giá đã gửi", "/reviews"],
      ["Uy tín", "/reputation"],
      ["Thành tích", "/achievements"],
      ["Báo cáo của tôi", "/reports"],
      ["Bổ sung báo cáo", "/reports/report-info"],
      ["Báo cáo đã giải quyết", "/reports/report-resolved"],
      ["Tùy chỉnh thông báo", "/preferences/notifications"],
      ["Quyền riêng tư", "/preferences/privacy"],
      ["Múi giờ", "/preferences/timezone"],
      ["Ngôn ngữ", "/preferences/language"],
      ["Trợ giúp", "/help"],
    ],
  },
] as const;
export const systemStates = {
  "404": [
    "Không tìm thấy trang",
    "Liên kết có thể đã thay đổi hoặc nội dung không còn tồn tại.",
    "/home",
  ],
  "403": [
    "Không có quyền truy cập",
    "Tài khoản hiện tại không được phép mở nội dung này.",
    "/home",
  ],
  "server-error": [
    "Chưa thể tải nội dung",
    "Đã xảy ra lỗi hệ thống. Hãy thử lại sau.",
    "/home",
  ],
  offline: [
    "Đang tải nội dung",
    "Nội dung sẽ tiếp tục tải khi kết nối sẵn sàng.",
    "/home",
  ],
  maintenance: [
    "Hệ thống đang bảo trì",
    "SkillHub sẽ trở lại khi công việc bảo trì hoàn tất.",
    "/home",
  ],
  suspended: [
    "Tài khoản đang bị hạn chế",
    "Xem lý do và thời hạn được hệ thống cung cấp. Đừng suy luận hạn chế từ số lỗi trên thiết bị.",
    "/help",
  ],
  locked: [
    "Tài khoản đang bị khóa",
    "Liên hệ hỗ trợ để xem xét quyết định khóa tài khoản.",
    "/help",
  ],
  "expired-confirmation": [
    "Phiên bản xác nhận đã thay đổi",
    "Mở phiên bản mới nhất, kiểm tra nội dung và xác nhận lại.",
    "/paths",
  ],
  "path-cancelled": [
    "Lộ trình đã hủy",
    "Hoàn trả và phí hủy, nếu có, phụ thuộc quyết định và chính sách hệ thống.",
    "/paths",
  ],
  "request-unavailable": [
    "Yêu cầu không còn nhận đề xuất",
    "Bài có thể đã khớp, hết hạn, bị hủy hoặc đang chờ kiểm duyệt.",
    "/discover",
  ],
  "user-blocked": [
    "Không thể kết nối người này",
    "Kiểm tra trạng thái tài khoản hoặc chọn một người chia sẻ khác.",
    "/search",
  ],
  "file-upload-failed": [
    "Tệp chưa được tải lên",
    "Kiểm tra định dạng, kích thước và kết nối. Tệp chưa được coi là bằng chứng đã gửi.",
    "/my-skills",
  ],
  "file-too-large": [
    "Tệp vượt giới hạn chat",
    "Chọn tệp tối đa 15 MB. Giới hạn bằng chứng và tài liệu được cấu hình riêng.",
    "/messages",
  ],
  "livekit-failed": [
    "Chưa thể vào phòng học",
    "Kiểm tra kết nối và điều kiện buổi học. Gặp lỗi kết nối không xác nhận buổi học hoàn thành.",
    "/calendar",
  ],
  "camera-permission-denied": [
    "Chưa có quyền camera",
    "Bạn có thể bật quyền camera trong cài đặt thiết bị trước khi tham gia phòng thật.",
    "/calendar",
  ],
  "mic-permission-denied": [
    "Chưa có quyền microphone",
    "Bật quyền microphone trong cài đặt thiết bị để trao đổi bằng âm thanh.",
    "/calendar",
  ],
  "session-not-started": [
    "Buổi học chưa bắt đầu",
    "Kiểm tra lịch. Thời điểm mở phòng phụ thuộc cấu hình của buổi học.",
    "/calendar",
  ],
  "session-already-ended": [
    "Buổi học đã kết thúc",
    "Xem chi tiết và xác nhận đã học nếu đã đủ điều kiện.",
    "/calendar",
  ],
  "schedule-conflict": [
    "Lịch đang bị trùng",
    "Kiểm tra các buổi của cả hai kế hoạch trước khi gửi lại lịch.",
    "/paths/path-ready/schedules",
  ],
  "insufficient-credit": [
    "Chưa đủ Credit",
    "Kiểm tra số dư khả dụng của người cần tạm giữ Credit.",
    "/wallet",
  ],
  loading: ["Đang tải nội dung", "Chờ nội dung được cập nhật.", "/home"],
  empty: [
    "Chưa có nội dung",
    "Bắt đầu bằng việc tìm người chia sẻ hoặc đăng một nhu cầu học.",
    "/discover",
  ],
} as const;
export function UiCatalogScreen() {
  return (
    <FeaturePage
      title="Bộ giao diện mobile"
      subtitle="Các luồng người dùng và trạng thái mẫu theo SRS 1.6. Staff/Admin thuộc ứng dụng web."
      back="/profile"
    >
      {groups.map((group) => (
        <Panel key={group.title} title={group.title}>
          {group.items.map(([label, href]) =>
            href.startsWith("/learning-sessions/") ? (
              <Button
                key={`${href}:${label}`}
                variant="paper"
                disabled
                onPress={() => {}}
              >
                {label} · Chưa khả dụng
              </Button>
            ) : (
              <RouteButton key={`${href}:${label}`} secondary href={href}>
                {label}
              </RouteButton>
            ),
          )}
        </Panel>
      ))}
      <Panel title="Hệ thống & tình huống biên">
        {Object.entries(systemStates).map(([key, [title]]) => (
          <RouteButton key={key} secondary href={`/states/${key}`}>
            {title}
          </RouteButton>
        ))}
      </Panel>
    </FeaturePage>
  );
}
export function SystemStateScreen() {
  const { state = "404" } = useLocalSearchParams<{ state: string }>();
  if (state === "offline") return <ConnectionScreen />;
  const item =
    systemStates[state as keyof typeof systemStates] ?? systemStates["404"];
  return (
    <FeaturePage title="Trạng thái hệ thống" back="/ui">
      <Panel title={item[0]}>
        {state === "loading" && (
          <ActivityIndicator
            presentation="inline"
            accessibilityLabel="Đang tải"
          />
        )}
        <Copy>{item[1]}</Copy>
        <RouteButton href={item[2]}>Quay lại nội dung liên quan</RouteButton>
      </Panel>
    </FeaturePage>
  );
}
