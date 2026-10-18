import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ControlledInput } from "@/components/ControlledInput";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import {
  apiProposalForm,
  proposalHints,
  type ApiProposalValues,
} from "../schemas/api-proposal-form";
import type { ProposalHints, Proposal } from "../api/proposals-api";

export function ApiProposalForm({
  proposal,
  pending,
  disabled,
  locked = false,
  onSubmit,
}: {
  proposal?: Proposal;
  pending: boolean;
  disabled?: boolean;
  locked?: boolean;
  onSubmit: (hints: ProposalHints) => Promise<unknown>;
}) {
  const [clearCandidateSlots, setClearCandidateSlots] = useState(false);
  const { control, handleSubmit } = useForm<ApiProposalValues>({
    resolver: zodResolver(apiProposalForm),
    defaultValues: {
      message: proposal?.message ?? "",
    },
  });
  return (
    <>
      <ControlledInput
        control={control}
        name="message"
        label="Nội dung đề xuất"
        required
        multiline
        maxLength={2000}
        editable={!pending && !locked}
      />
      <Copy muted>
        Hình thức học, Credit, số buổi và lịch học sẽ được thống nhất trong cuộc
        trò chuyện sau khi đề xuất được chấp nhận.
      </Copy>
      {!!proposal?.candidateSlots.length && (
        <>
          <Copy muted>
            {clearCandidateSlots
              ? "Các khung giờ gợi ý sẽ được bỏ khi bạn lưu thay đổi."
              : `Đang giữ ${proposal.candidateSlots.length} khung giờ gợi ý đã gửi. Nếu giờ đã qua, cần bỏ khung giờ để lưu thay đổi.`}
          </Copy>
          <Button
            variant="secondary"
            disabled={pending || disabled || locked}
            onPress={() => setClearCandidateSlots((value) => !value)}
          >
            {clearCandidateSlots
              ? "Giữ lại các khung giờ gợi ý"
              : "Bỏ các khung giờ gợi ý đã lưu"}
          </Button>
        </>
      )}
      <Button
        variant="craft"
        disabled={pending || disabled || locked}
        onPress={() => {
          void handleSubmit((v) =>
            onSubmit(
              proposalHints(
                v,
                !!proposal?.candidateSlots.length && clearCandidateSlots,
              ),
            ),
          )();
        }}
      >
        {pending ? "Đang gửi..." : proposal ? "Lưu thay đổi" : "Gửi đề xuất"}
      </Button>
    </>
  );
}
