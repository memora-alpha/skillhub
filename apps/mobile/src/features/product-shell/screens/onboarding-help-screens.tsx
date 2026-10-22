import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useProductPreview } from "../context";
import { LocalePreviewScreen } from "./locale-screen";
export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const { interests, setInterests } = useProductPreview();
  return (
    <FeaturePage title="Bắt đầu với SkillHub" back="/home">
      <Panel
        title={
          [
            "Chào mừng bạn",
            "Bạn muốn học gì?",
            "Bạn có thể chia sẻ gì?",
            "Sẵn sàng kết nối",
          ][step]
        }
      >
        <Copy>Bước {step + 1}/4</Copy>
        {step === 0 && (
          <>
            <Copy>
              Mỗi người đều có điều đáng để chia sẻ. Hoàn thiện hồ sơ để cộng
              đồng hiểu bạn hơn.
            </Copy>
            <RouteButton secondary href="/edit-profile">
              Hoàn thiện hồ sơ của tôi
            </RouteButton>
          </>
        )}
        {step === 1 && (
          <>
            <Copy>Chọn mối quan tâm cho bản xem thử.</Copy>
            {["React", "UI/UX", "Tiếng Anh", "Guitar", "Nhiếp ảnh"].map(
              (skill) => (
                <Button
                  key={skill}
                  variant={interests.includes(skill) ? "craft" : "paper"}
                  leadingIcon={interests.includes(skill) ? "check" : undefined}
                  onPress={() =>
                    setInterests(
                      interests.includes(skill)
                        ? interests.filter((i) => i !== skill)
                        : [...interests, skill],
                    )
                  }
                >
                  {skill}
                </Button>
              ),
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Copy>
              Thêm kỹ năng và gửi bằng chứng nếu muốn xác minh. Kỹ năng chưa xác
              minh được ghi nhãn rõ ràng.
            </Copy>
            <RouteButton href="/my-skills/new">Thêm kỹ năng</RouteButton>
          </>
        )}
        {step === 3 && (
          <>
            <Copy>
              Khám phá yêu cầu học, trao đổi đề xuất và thống nhất từng kế hoạch
              trước khi chốt lịch.
            </Copy>
            <RouteButton href="/search">Tìm người chia sẻ</RouteButton>
            <RouteButton secondary href="/home">
              Về trang chủ
            </RouteButton>
          </>
        )}
        {step < 3 && (
          <Button onPress={() => setStep((s) => s + 1)}>Tiếp tục</Button>
        )}
        {step > 0 && (
          <Button variant="paper" onPress={() => setStep((s) => s - 1)}>
            Bước trước
          </Button>
        )}
      </Panel>
    </FeaturePage>
  );
}
const faqs = [
  [
    "Chấp nhận đề xuất đã chốt lịch chưa?",
    "Chấp nhận chỉ mở cuộc trao đổi. Hai bên vẫn cần tạo kế hoạch, xác nhận kế hoạch, điều khoản và từng lịch trước khi khóa lịch.",
  ],
  [
    "Trao đổi hai chiều cần mấy kế hoạch?",
    "Hai kế hoạch đối ứng. Mỗi người tự tạo kế hoạch cho kỹ năng mình dạy, người học xác nhận phiên bản hiện tại.",
  ],
  [
    "Khi nào Credit được quyết toán?",
    "Sau khi tất cả buổi học trong thỏa thuận hoàn thành và không có tranh chấp giữ quyết toán. Hoàn thành một buổi chưa quyết toán.",
  ],
  [
    "Tôi có thể đổi lịch không?",
    "Hai bên phải cùng xác nhận lịch mới ít nhất 60 phút trước giờ bắt đầu của lịch cũ. Nếu chưa đủ xác nhận, lịch cũ giữ nguyên.",
  ],
  [
    "Có thể rút Credit không?",
    "SkillHub chưa hỗ trợ rút hoặc quy đổi Credit thành tiền. Credit dùng cho học tập và tài liệu trên nền tảng.",
  ],
  [
    "Bằng chứng xác minh có công khai không?",
    "Người xem hồ sơ chỉ thấy trạng thái xác minh. Tệp bằng chứng riêng tư không được công khai.",
  ],
];
export function HelpScreen() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string>();
  return (
    <FeaturePage title="Trung tâm trợ giúp" back="/profile" demo={false}>
      <Input label="Tìm câu hỏi" value={search} onChangeText={setSearch} />
      {faqs
        .filter(([q, a]) =>
          `${q} ${a}`.toLowerCase().includes(search.toLowerCase()),
        )
        .map(([q, a]) => (
          <Panel key={q}>
            <Button
              variant="paper"
              onPress={() => setExpanded(expanded === q ? undefined : q)}
            >
              {q}
            </Button>
            {expanded === q && <Copy>{a}</Copy>}
          </Panel>
        ))}
      <RouteButton secondary href="/reports">
        Theo dõi báo cáo
      </RouteButton>
      <RouteButton secondary href="/policies">
        Quyền riêng tư & nguyên tắc sử dụng
      </RouteButton>
    </FeaturePage>
  );
}
export function PreferencesScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { enabled, toggle } = useProductPreview();
  if (section === "timezone" || section === "language")
    return <LocalePreviewScreen section={section} />;
  if (section !== "notifications" && section !== "privacy")
    return (
      <FeaturePage title="Tùy chọn" back="/account-settings">
        <Copy>Không tìm thấy mục cài đặt này.</Copy>
      </FeaturePage>
    );
  return (
    <FeaturePage
      title={
        section === "notifications" ? "Tùy chỉnh thông báo" : "Quyền riêng tư"
      }
      back="/account-settings"
    >
      {section === "notifications" ? (
        <Panel title="Nhóm thông báo trong bản xem thử">
          {["Học tập", "Credit", "Cộng đồng"].map((group) => (
            <Button key={group} variant="paper" onPress={() => toggle(group)}>
              {group}: {enabled.includes(group) ? "Đang bật" : "Đã tắt"}
            </Button>
          ))}
          <Copy muted>
            Lựa chọn này chỉ lọc trung tâm thông báo mẫu; không thay đổi email
            hoặc push thực tế.
          </Copy>
          <RouteButton href="/notifications">
            Xem trung tâm thông báo
          </RouteButton>
        </Panel>
      ) : (
        <Panel title="Bạn quyết định điều mình chia sẻ">
          <Copy>
            Email đăng nhập, thông tin thanh toán, bằng chứng và tệp tài liệu
            riêng tư không được hiển thị trên hồ sơ công khai.
          </Copy>
          <RouteButton href="/my-skills">Quản lý hiển thị kỹ năng</RouteButton>
          <RouteButton secondary href="/profile">
            Xem hồ sơ của tôi
          </RouteButton>
        </Panel>
      )}
    </FeaturePage>
  );
}
export function PoliciesScreen() {
  return (
    <FeaturePage title="Quyền riêng tư & sử dụng" back="/help" demo={false}>
      <Panel title="Thông tin công khai">
        <Copy>
          Tên hiển thị, avatar, bio, uy tín, danh hiệu đã chọn và kỹ năng chia
          sẻ có thể xuất hiện trên hồ sơ. Email, thông tin thanh toán và bằng
          chứng riêng tư không công khai.
        </Copy>
      </Panel>
      <Panel title="Trao đổi có trách nhiệm">
        <Copy>
          Thống nhất nội dung và lịch bằng các nút xác nhận đúng phiên bản. Tôn
          trọng người trao đổi, quyền phân phối tài liệu và báo cáo vấn đề có
          căn cứ.
        </Copy>
      </Panel>
      <Panel title="Credit">
        <Copy>
          1.000 VND = 1 Credit. Không hỗ trợ rút tiền. Quyết toán cuối Learning
          Path theo hình thức học; tranh chấp có thể giữ việc quyết toán.
        </Copy>
      </Panel>
      <Copy muted>
        Nội dung này tóm tắt nguyên tắc sản phẩm trong SRS 1.6. Điều khoản pháp
        lý và chính sách lưu giữ dữ liệu chính thức cần được cung cấp trước khi
        phát hành.
      </Copy>
    </FeaturePage>
  );
}
