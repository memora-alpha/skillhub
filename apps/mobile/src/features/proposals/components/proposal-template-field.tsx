import { useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, Text, View, type TextInput } from "react-native";
import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/Input";
import { appColors, fonts, typography } from "@/constants/theme";
import type { ApiProposalValues } from "../schemas/api-proposal-form";

const messageTemplates = [
  {
    title: "Trao đổi kỹ năng",
    message:
      "Chào bạn! Mình muốn cùng bạn trao đổi kỹ năng và học hỏi lẫn nhau. Cùng bàn thêm về điều mỗi người muốn học nhé!",
  },
  {
    title: "Đề nghị hướng dẫn",
    message:
      "Chào bạn! Mình có thể hướng dẫn phần bạn đang muốn học. Cùng trao đổi thêm để chọn nội dung và cách học phù hợp nhé!",
  },
  {
    title: "Tìm hiểu mục tiêu",
    message:
      "Chào bạn! Mình muốn tìm hiểu mục tiêu học của bạn trước. Bạn muốn bắt đầu từ đâu và mong đạt được điều gì?",
  },
] as const;

const availabilityTemplates = [
  {
    title: "Buổi tối trong tuần",
    message: "Mình thường rảnh các buổi tối trong tuần, từ 19:00 đến 21:00.",
  },
  {
    title: "Cuối tuần",
    message: "Mình rảnh sáng thứ 7 hoặc Chủ nhật, từ 9:00 đến 11:00.",
  },
  {
    title: "Lịch linh hoạt",
    message:
      "Lịch của mình khá linh hoạt. Cùng trao đổi để chọn thời gian phù hợp nhé!",
  },
] as const;

export function ProposalTemplateField({
  control,
  name,
  disabled,
  inputRef,
}: {
  control: Control<ApiProposalValues>;
  name: "message" | "candidateSlots";
  disabled: boolean;
  inputRef: RefObject<TextInput | null>;
}) {
  const isMessage = name === "message";
  const templates = isMessage ? messageTemplates : availabilityTemplates;
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const keepSuggestions = () => {
    clearTimeout(blurTimer.current);
    setFocused(true);
  };
  const hideSuggestions = () => {
    clearTimeout(blurTimer.current);
    // Allow focus to move to a template (including with Tab) before hiding it.
    blurTimer.current = setTimeout(() => setFocused(false), 0);
  };
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View
          style={{ gap: 6 }}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <Input
            ref={(node) => {
              inputRef.current = node;
              field.ref(node);
            }}
            label={isMessage ? "Lời nhắn" : "Lịch rảnh (tùy chọn)"}
            required={isMessage}
            multiline
            maxLength={isMessage ? 2000 : undefined}
            placeholder={
              isMessage
                ? "Chia sẻ điều bạn có thể dạy và mong muốn của bạn…"
                : "Ví dụ: Tối thứ 5 và thứ 7"
            }
            editable={!disabled}
            value={field.value}
            onChangeText={field.onChange}
            onFocus={keepSuggestions}
            onBlur={() => {
              field.onBlur();
              hideSuggestions();
            }}
            error={fieldState.error?.message}
          />
          {focused && !disabled && (
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  ...typography.secondary,
                  fontFamily: fonts.body,
                  color: appColors.muted,
                }}
              >
                Chọn mẫu rồi sửa theo ý bạn
              </Text>
              <View
                style={{
                  gap: 6,
                  flexDirection: isMessage ? "column" : "row",
                  flexWrap: "wrap",
                }}
              >
                {templates.map((template) => (
                  <Pressable
                    key={template.title}
                    accessibilityRole="button"
                    accessibilityLabel={`Dùng mẫu: ${template.title}`}
                    accessibilityHint={template.message}
                    disabled={disabled}
                    onFocus={keepSuggestions}
                    onBlur={hideSuggestions}
                    onPressIn={(event) => {
                      // Keep the textarea focused until the template is selected.
                      if (!("key" in event.nativeEvent)) event.preventDefault();
                    }}
                    onPress={() => {
                      if (disabled) return;
                      field.onChange(template.message);
                      inputRef.current?.focus();
                      keepSuggestions();
                    }}
                    style={({ pressed }) => ({
                      padding: 12,
                      minHeight: 44,
                      gap: 4,
                      borderWidth: 1,
                      borderRadius: 8,
                      borderColor: appColors.border,
                      backgroundColor: pressed
                        ? appColors.primarySoft
                        : appColors.surfaceInset,
                    })}
                  >
                    <Text
                      style={{
                        ...typography.secondary,
                        fontFamily: fonts.semibold,
                        color: appColors.body,
                      }}
                    >
                      {template.title}
                    </Text>
                    {isMessage && (
                      <Text
                        numberOfLines={2}
                        style={{
                          ...typography.secondary,
                          fontFamily: fonts.body,
                          color: appColors.muted,
                        }}
                      >
                        {template.message}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    />
  );
}
