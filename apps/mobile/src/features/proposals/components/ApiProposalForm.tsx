import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ControlledInput } from "@/components/ControlledInput";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { ChoiceGroup } from "@/components/choice-group";
import { FormNotice } from "@/components/FormNotice";
import {
  apiProposalForm,
  proposalHints,
  proposalFormValues,
  type ApiProposalValues,
} from "../schemas/api-proposal-form";
import type { ProposalHints, Proposal } from "../api/proposals-api";
import { ProposalTemplateField } from "./proposal-template-field";
function exchangeChoice(value: ApiProposalValues["type"]) {
  if (value === "TWO_WAY") return "Trao đổi";
  if (value === "ONE_WAY") return "Tôi muốn dạy bạn";
  return "";
}

export function ApiProposalForm({
  proposal,
  pending,
  disabled,
  locked = false,
  onSubmit,
}: Readonly<{
  proposal?: Proposal;
  pending: boolean;
  disabled?: boolean;
  locked?: boolean;
  onSubmit: (hints: ProposalHints) => Promise<unknown>;
}>) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ApiProposalValues>({
    resolver: zodResolver(apiProposalForm),
    shouldUnregister: false,
    defaultValues: {
      ...proposalFormValues(proposal),
      type: proposal ? (proposal.exchangeTypeHint ?? "") : "TWO_WAY",
    },
  });
  const inactive = pending || !!disabled || locked;
  const [showDetails, setShowDetails] = useState(false);
  const messageInput = useRef<TextInput | null>(null);
  const availabilityInput = useRef<TextInput | null>(null);
  const outsideTouch = useRef<{ x: number; y: number } | null>(null);
  const detailErrors = !!(errors.credit || errors.sessions || errors.duration);
  const submitLabel = proposal ? "Lưu thay đổi" : "Gửi đề xuất";
  return (
    <View
      style={{ gap: 12 }}
      onTouchStart={(event) => {
        const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
        outsideTouch.current = {
          x: touch.pageX,
          y: touch.pageY,
        };
      }}
      onTouchMove={(event) => {
        const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
        const start = outsideTouch.current;
        if (
          start &&
          Math.hypot(touch.pageX - start.x, touch.pageY - start.y) > 8
        )
          outsideTouch.current = null;
      }}
      onTouchEnd={() => {
        if (outsideTouch.current) {
          messageInput.current?.blur();
          availabilityInput.current?.blur();
        }
        outsideTouch.current = null;
      }}
      onTouchCancel={() => {
        outsideTouch.current = null;
      }}
    >
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <ChoiceGroup
            label="Bạn muốn đề xuất gì?"
            options={["Trao đổi", "Tôi muốn dạy bạn"]}
            value={exchangeChoice(field.value)}
            disabled={inactive}
            onChange={(value) => {
              if (!inactive)
                field.onChange(value === "Trao đổi" ? "TWO_WAY" : "ONE_WAY");
            }}
          />
        )}
      />
      {errors.type && (
        <FormNotice tone="error">{errors.type.message}</FormNotice>
      )}
      <ProposalTemplateField
        control={control}
        name="message"
        disabled={inactive}
        inputRef={messageInput}
      />
      <ProposalTemplateField
        control={control}
        name="candidateSlots"
        disabled={inactive}
        inputRef={availabilityInput}
      />
      <Button
        variant="ghost"
        disabled={inactive}
        onPress={() => {
          if (!inactive) setShowDetails((value) => !value);
        }}
      >
        {showDetails ? "Thu gọn chi tiết" : "Thêm Credit và số buổi (tùy chọn)"}
      </Button>
      {(showDetails || detailErrors) && (
        <>
          <ControlledInput
            control={control}
            name="credit"
            label="Credit gợi ý"
            keyboardType="decimal-pad"
            editable={!inactive}
            hint="Trao đổi: từ 20 Credit mỗi người. Đây là gợi ý để cùng bàn thêm."
          />
          <ControlledInput
            control={control}
            name="sessions"
            label="Số buổi dự kiến"
            keyboardType="number-pad"
            editable={!inactive}
          />
          <ControlledInput
            control={control}
            name="duration"
            label="Thời lượng mỗi buổi (phút)"
            keyboardType="number-pad"
            editable={!inactive}
            hint="Từ 60 đến 180 phút."
          />
        </>
      )}
      <Copy muted>
        Đồng ý đề xuất sẽ mở Chat. Hai bạn chốt nội dung, lịch học và Credit
        sau.
      </Copy>
      <Button
        variant="craft"
        disabled={inactive}
        onPress={() => {
          if (!inactive)
            void handleSubmit((values) =>
              onSubmit(proposalHints(values, proposal)),
            )();
        }}
      >
        {pending ? "Đang gửi..." : submitLabel}
      </Button>
    </View>
  );
}
