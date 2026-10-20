import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ControlledInput } from "@/components/ControlledInput";
import { ChoiceGroup } from "@/components/choice-group";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { agreementInputSchema, type AgreementInput } from "../agreement-input";
import type {
  ApiLearningPath,
  CreateLearningPathInput,
} from "../api/learning-paths-contract";

export function ApiAgreementForm({
  path,
  userId,
  otherId,
  conversationId,
  pending,
  onSubmit,
}: Readonly<{
  path?: ApiLearningPath;
  userId: string;
  otherId: string;
  conversationId: string;
  pending: boolean;
  onSubmit: (input: CreateLearningPathInput) => Promise<void>;
}>) {
  const { control, watch, setValue, handleSubmit } = useForm<AgreementInput>({
    resolver: zodResolver(agreementInputSchema),
    defaultValues: {
      type: path?.agreement.exchangeType ?? "TWO_WAY",
      role:
        path?.agreement.teacherId && path.agreement.teacherId !== userId
          ? "learner"
          : "teacher",
      credit:
        path?.agreement.totalCreditPerUser ??
        path?.agreement.negotiatedCredit ??
        "20",
    },
  });
  const type = watch("type"),
    role = watch("role");
  const submitLabel = path
    ? "Lưu thay đổi để cùng xem lại"
    : "Tiếp tục: nội dung học";
  return (
    <>
      <ChoiceGroup
        label="Hai bạn muốn học thế nào?"
        options={["Hai người dạy cho nhau", "Một người dạy"]}
        value={type === "TWO_WAY" ? "Hai người dạy cho nhau" : "Một người dạy"}
        onChange={(v) => {
          if (!pending)
            setValue(
              "type",
              v === "Hai người dạy cho nhau" ? "TWO_WAY" : "ONE_WAY",
            );
        }}
      />
      {type === "ONE_WAY" && (
        <ChoiceGroup
          label="Vai trò của bạn"
          options={["Tôi dạy", "Tôi học"]}
          value={role === "teacher" ? "Tôi dạy" : "Tôi học"}
          onChange={(v) => {
            if (!pending)
              setValue("role", v === "Tôi dạy" ? "teacher" : "learner");
          }}
        />
      )}
      <ControlledInput
        control={control}
        name="credit"
        label={
          type === "TWO_WAY"
            ? "Mỗi người cam kết bao nhiêu Credit?"
            : "Tổng giá học (Credit)"
        }
        keyboardType="decimal-pad"
        editable={!pending}
      />
      <Copy muted>
        {type === "TWO_WAY"
          ? "Tối thiểu 20 Credit/người. Hai bạn tự soạn phần mình dạy và đồng ý phần mình học. Credit chỉ tạm giữ ở bước chốt lịch."
          : "Giá cho tất cả buổi học. Người dạy soạn nội dung; chỉ người học tạm giữ Credit ở bước chốt lịch."}
      </Copy>
      {path && (
        <Copy muted>
          Thay đổi điều khoản tạo phiên bản mới, cần xác nhận lại điều khoản và
          đề xuất lại lịch.
        </Copy>
      )}
      <Button
        disabled={pending}
        onPress={() => {
          void handleSubmit(async (v) => {
            const teacherId = v.role === "teacher" ? userId : otherId;
            const learnerId = v.role === "teacher" ? otherId : userId;
            return onSubmit(
              v.type === "TWO_WAY"
                ? {
                    conversationId,
                    exchangeType: "TWO_WAY",
                    totalCreditPerUser: v.credit,
                  }
                : {
                    conversationId,
                    exchangeType: "ONE_WAY",
                    teacherId,
                    learnerId,
                    negotiatedCredit: v.credit,
                  },
            );
          })();
        }}
      >
        {pending ? "Đang lưu..." : submitLabel}
      </Button>
    </>
  );
}
