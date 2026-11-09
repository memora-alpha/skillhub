import { useState } from "react";
import { Button } from "@/components/Button";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useProductPreview } from "../context";
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
