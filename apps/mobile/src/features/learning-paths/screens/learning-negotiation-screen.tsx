import { useState } from "react";
import { uuid } from "@/lib/http/contracts";
import { EmptyState } from "@/components/EmptyState";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { ChoiceGroup } from "@/components/choice-group";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantName,
} from "@/features/connections";
import { useConversation, useMessageSend } from "@/features/messages";
import { usePathsPreview } from "../context";
import { ApiAgreementEntry } from "../components/ApiAgreementEntry";
import {
  negotiationSchema,
  negotiationMessage,
  type NegotiationDraft,
} from "../negotiation";

export function LearningNegotiationScreen({
  conversationId,
}: {
  conversationId: string;
}) {
  const query = useConversation(conversationId);
  if (!uuid.safeParse(conversationId).success)
    return (
      <FeaturePage title="Lộ trình học" demo={false} back="/messages">
        <EmptyState
          title="Chọn cuộc trao đổi"
          description="Mở lộ trình từ một cuộc trao đổi đã được chấp nhận."
        />
      </FeaturePage>
    );
  return (
    <FeaturePage
      title="Lộ trình học"
      demo={false}
      back={{
        pathname: "/chat/[proposalId]",
        params: { proposalId: conversationId, mode: "api" },
      }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && (
        <ApiAgreementEntry
          conversationId={conversationId}
          participantAId={query.data.participantAId}
          participantBId={query.data.participantBId}
        />
      )}
      {query.data && (
        <NegotiationForm
          key={conversationId}
          conversationId={conversationId}
          partnerId={query.data.participantBId}
          participantAId={query.data.participantAId}
        />
      )}
    </FeaturePage>
  );
}
function NegotiationForm({
  conversationId,
  partnerId,
  participantAId,
}: {
  conversationId: string;
  partnerId: string;
  participantAId: string;
}) {
  const runtime = useConnections(),
    router = useRouter(),
    preview = usePathsPreview();
  const other = participantAId === runtime.userId ? partnerId : participantAId;
  const name = useParticipantName(other),
    sender = useMessageSend(conversationId);
  const [saved, setSaved] = useState(false),
    [sent, setSent] = useState(false);
  const { control, watch, setValue, handleSubmit, formState } =
    useForm<NegotiationDraft>({
      resolver: zodResolver(negotiationSchema),
      defaultValues: preview.drafts[conversationId] ?? {
        type: "TWO_WAY",
        role: "teacher",
        credit: "20",
        skill: "",
        goal: "",
        outline: "",
      },
    });
  const type = watch("type"),
    role = watch("role");
  const persist = (draft: NegotiationDraft) => {
    preview.saveDraft(conversationId, draft);
    setSaved(true);
  };
  return (
    <>
      <Panel title={`Cùng ${name.data ?? "đối tác"} thiết kế cách học`}>
        <FormNotice tone="info">
          Bạn có thể lưu ý tưởng và gửi gợi ý qua Chat trước khi tạo hoặc sửa lộ
          trình chính thức ở phía trên.
        </FormNotice>
        <Copy muted>
          Gợi ý dưới đây chưa tạo kế hoạch chính thức, chưa xác nhận điều khoản
          hoặc giữ Credit.
        </Copy>
        <ChoiceGroup
          label="Hình thức mong muốn"
          options={["Trao đổi hai chiều", "Học một chiều"]}
          value={type === "TWO_WAY" ? "Trao đổi hai chiều" : "Học một chiều"}
          onChange={(v) => {
            if (!sender.pending && !sender.processing)
              setValue(
                "type",
                v === "Trao đổi hai chiều" ? "TWO_WAY" : "ONE_WAY",
                { shouldValidate: true },
              );
          }}
        />
        {type === "ONE_WAY" && (
          <ChoiceGroup
            label="Vai trò mong muốn"
            options={["Tôi dạy", "Tôi học"]}
            value={role === "teacher" ? "Tôi dạy" : "Tôi học"}
            onChange={(v) => {
              if (!sender.pending && !sender.processing)
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
              : "Credit gợi ý toàn lộ trình"
          }
          keyboardType="decimal-pad"
          editable={!sender.pending && !sender.processing}
        />
        <ControlledInput
          control={control}
          name="skill"
          label={
            type === "ONE_WAY" && role === "learner"
              ? "Kỹ năng muốn học"
              : "Kỹ năng bạn muốn dạy"
          }
          editable={!sender.pending && !sender.processing}
        />
        <ControlledInput
          control={control}
          name="goal"
          label="Mục tiêu học"
          multiline
          maxLength={500}
          editable={!sender.pending && !sender.processing}
        />
        <ControlledInput
          control={control}
          name="outline"
          label="Nội dung dự kiến từng buổi"
          multiline
          maxLength={1000}
          hint="Mỗi dòng là một buổi. Nội dung này dùng để thương lượng."
          editable={!sender.pending && !sender.processing}
        />
        <Copy muted>
          {type === "TWO_WAY"
            ? "Bạn đề xuất chiều mình dạy; đối tác tự tạo kế hoạch cho chiều họ dạy. Cả hai kế hoạch cần được người học xác nhận."
            : "Người dạy tạo kế hoạch; người học xác nhận đúng phiên bản. Cả hai cùng xác nhận lịch của kế hoạch đó."}
        </Copy>
        <ConnectionFeedback error={sender.error ?? sender.delivery.error} />
        {saved && (
          <FormNotice tone="success">
            Bản nháp đã lưu trong phiên này.
          </FormNotice>
        )}
        {sent && (
          <FormNotice tone={sender.processing ? "info" : "success"}>
            {sender.processing
              ? "Gợi ý đang được xử lý, chưa xác nhận đã gửi."
              : "Gợi ý đã được gửi trong Chat; chưa phải xác nhận lộ trình."}
          </FormNotice>
        )}
        <Button
          variant="secondary"
          disabled={sender.pending || sender.processing}
          onPress={() => {
            void handleSubmit(persist)();
          }}
        >
          Lưu bản nháp
        </Button>
        <Button
          variant="craft"
          disabled={
            sender.pending || sender.processing || !!formState.errors.root
          }
          onPress={() => {
            void handleSubmit(async (draft) => {
              persist(draft);
              setSent(await sender.send(negotiationMessage(draft)));
            })();
          }}
        >
          {sender.pending ? "Đang gửi..." : "Gửi gợi ý qua Chat"}
        </Button>
        {sender.processing && (
          <Button
            variant="secondary"
            onPress={() => {
              void sender.delivery.refetch();
            }}
          >
            Kiểm tra trạng thái gửi
          </Button>
        )}
      </Panel>
      <Panel title="Các bước để thống nhất lộ trình">
        <Copy>1. Người dạy tạo kế hoạch theo chiều mình dạy.</Copy>
        <Copy>
          2. Người học xác nhận phiên bản hiện tại; sửa nội dung cần xác nhận
          lại.
        </Copy>
        <Copy>
          3. Hai người xác nhận điều khoản chung và lịch gắn từng kế hoạch.
        </Copy>
        <Copy>
          4. Hệ thống kiểm tra lịch, số dư và quyền trước khi giữ Credit và tạo
          buổi học.
        </Copy>
        <Copy muted>
          Mở lộ trình chính thức ở phía trên để thực hiện từng bước. Trạng thái
          xác nhận được tải từ hệ thống.
        </Copy>
      </Panel>
      <Button
        variant="secondary"
        onPress={() =>
          router.dismissTo({
            pathname: "/chat/[proposalId]",
            params: { proposalId: conversationId, mode: "api" },
          })
        }
      >
        Trở lại chat
      </Button>
    </>
  );
}
