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
}: {
  path?: ApiLearningPath;
  userId: string;
  otherId: string;
  conversationId: string;
  pending: boolean;
  onSubmit: (input: CreateLearningPathInput) => Promise<void>;
}) {
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
  return (
    <>
      <ChoiceGroup
        label="Hình thức"
        options={["Trao đổi hai chiều", "Học một chiều"]}
        value={type === "TWO_WAY" ? "Trao đổi hai chiều" : "Học một chiều"}
        onChange={(v) => {
          if (!pending)
            setValue(
              "type",
              v === "Trao đổi hai chiều" ? "TWO_WAY" : "ONE_WAY",
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
            ? "Credit cam kết mỗi người"
            : "Credit cho toàn lộ trình"
        }
        keyboardType="decimal-pad"
        editable={!pending}
      />
      <Copy muted>
        {type === "TWO_WAY"
          ? "Mỗi người tự tạo kế hoạch mình dạy; người học xác nhận từng kế hoạch."
          : "Người dạy tạo kế hoạch; chỉ người học tạm giữ Credit khi chốt lịch."}
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
          void handleSubmit(async (v) =>
            onSubmit(
              v.type === "TWO_WAY"
                ? {
                    conversationId,
                    exchangeType: "TWO_WAY",
                    totalCreditPerUser: v.credit,
                  }
                : {
                    conversationId,
                    exchangeType: "ONE_WAY",
                    teacherId: v.role === "teacher" ? userId : otherId,
                    learnerId: v.role === "teacher" ? otherId : userId,
                    negotiatedCredit: v.credit,
                  },
            ),
          )();
        }}
      >
        {pending ? "Đang gửi..." : path ? "Gửi điều khoản mới" : "Tạo lộ trình"}
      </Button>
    </>
  );
}
