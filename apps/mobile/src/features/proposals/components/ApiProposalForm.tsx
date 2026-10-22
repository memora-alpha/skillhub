import { useRef, useState, type ReactNode } from "react";
import { View, Pressable, Text, type TextInput } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ControlledInput } from "@/components/ControlledInput";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  apiProposalForm,
  proposalHints,
  proposalFormValues,
  type ApiProposalValues,
} from "../schemas/api-proposal-form";
import type { ProposalHints, Proposal } from "../api/proposals-api";
import { ProposalTemplateField } from "./proposal-template-field";
import {
  ProposalSendFrame,
  ProposalTypeChoice,
  ProposalSafetyNote,
} from "./proposal-send-layout";
function InlineFrame({
  children,
  action,
}: Readonly<{ children: ReactNode; action: ReactNode }>) {
  return (
    <View style={{ gap: 12 }}>
      {children}
      {action}
    </View>
  );
}

export function ApiProposalForm({
  proposal,
  oneWayLabel = proposal?.sourceType === "DIRECT_SEARCH"
    ? "Tôi muốn học từ bạn"
    : "Tôi muốn dạy bạn",
  pending,
  disabled,
  locked = false,
  onSubmit,
  header,
  framed = false,
}: Readonly<{
  proposal?: Proposal;
  oneWayLabel?: string;
  pending: boolean;
  disabled?: boolean;
  locked?: boolean;
  onSubmit: (hints: ProposalHints) => Promise<unknown>;
  header?: ReactNode;
  framed?: boolean;
}>) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ApiProposalValues>({
    resolver: zodResolver(apiProposalForm),
    mode: "onBlur",
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
  const Frame = framed ? ProposalSendFrame : InlineFrame;
  const action = (
    <Button
      variant="craft"
      leadingIcon="send"
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
  );
  return (
    <Frame action={action}>
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
        {header}
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ProposalTypeChoice
              oneWayLabel={oneWayLabel}
              value={field.value}
              disabled={inactive}
              onChange={(value) => {
                if (!inactive) field.onChange(value);
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm Credit và số buổi (tùy chọn)"
          accessibilityState={{
            expanded: showDetails || detailErrors,
            disabled: inactive,
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: appRadius.control,
            backgroundColor: colors.surface,
          }}
          disabled={inactive}
          onPress={() => {
            if (!inactive) setShowDetails((value) => !value);
          }}
        >
          <Icon name="wallet" size={20} color={colors.primary} />
          <Text
            style={{
              ...typography.body,
              fontFamily: fonts.semibold,
              color: colors.ink,
              flex: 1,
            }}
          >
            {showDetails ? "Thu gọn chi tiết" : "Thêm Credit và số buổi"}
          </Text>
          <Icon
            name={showDetails ? "close" : "plus"}
            size={17}
            color={colors.muted}
          />
        </Pressable>
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
        <ProposalSafetyNote />
      </View>
    </Frame>
  );
}
