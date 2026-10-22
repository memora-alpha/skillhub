import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  useFieldArray,
  useWatch,
  useFormState,
  Controller,
  type Control,
} from "react-hook-form";
import { Input } from "@/components/Input";
import {
  sessionContentParts,
  sessionContentText,
} from "../utils/session-content";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { PlanEditorValues } from "../schemas/plan-editor-input";

function activeIndexAfterRemove(active: number | null, removed: number) {
  if (active === removed) return null;
  if (active !== null && active > removed) return active - 1;
  return active;
}

export function PlanOutlineEditor({
  control,
  disabled,
  error,
}: Readonly<{
  control: Control<PlanEditorValues>;
  disabled: boolean;
  error?: string;
}>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "sessionOutline",
  });
  const values = useWatch({ control, name: "sessionOutline" });
  const { errors } = useFormState({ control });
  const [active, setActive] = useState<number | null>(
    fields.length === 1 && !fields[0]?.content ? 0 : null,
  );
  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <Text style={styles.label}>
          Nội dung từng buổi <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.count}>{fields.length} buổi</Text>
      </View>
      {fields.map((field, index) => (
        <View
          key={field.id}
          style={[styles.card, active === index && styles.active]}
        >
          <View style={styles.row}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa buổi ${index + 1}`}
              disabled={disabled}
              onPress={() => setActive(active === index ? null : index)}
              style={styles.content}
            >
              <Text numberOfLines={2} style={styles.title}>
                {sessionContentParts(
                  values?.[index]?.content ?? "",
                ).title.trim() || "Nhập tiêu đề buổi học"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa nội dung buổi ${index + 1}`}
              disabled={disabled}
              onPress={() => setActive(active === index ? null : index)}
              style={styles.icon}
            >
              <Icon name="edit" size={16} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xóa buổi ${index + 1}`}
              disabled={disabled}
              onPress={() => {
                remove(index);
                setActive(activeIndexAfterRemove(active, index));
              }}
              style={styles.icon}
            >
              <Icon name="trash" size={16} color={colors.muted} />
            </Pressable>
          </View>
          {active !== index &&
            !!errors.sessionOutline?.[index]?.content?.message && (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors.sessionOutline[index]!.content!.message}
              </Text>
            )}
          {active === index && (
            <View style={styles.editor}>
              <Controller
                control={control}
                name={`sessionOutline.${index}.content`}
                render={({ field, fieldState }) => {
                  const { title, description } = sessionContentParts(
                    field.value,
                  );
                  return (
                    <>
                      <Input
                        label={`Tiêu đề buổi ${index + 1}`}
                        required
                        error={
                          !title.trim() ? fieldState.error?.message : undefined
                        }
                        value={title}
                        onChangeText={(value) =>
                          field.onChange(sessionContentText(value, description))
                        }
                        onBlur={field.onBlur}
                        ref={field.ref}
                        editable={!disabled}
                        maxLength={2000}
                        reserveMessageSpace={false}
                        placeholder="Ví dụ: Nền tảng React và JSX"
                      />
                      <Input
                        label={`Mô tả buổi ${index + 1} (tùy chọn)`}
                        value={description}
                        onChangeText={(value) =>
                          field.onChange(sessionContentText(title, value))
                        }
                        onBlur={field.onBlur}
                        editable={!disabled}
                        multiline
                        maxLength={2000}
                        reserveMessageSpace={false}
                        placeholder="Nội dung thực hành, kiến thức hoặc điều cần chuẩn bị…"
                        error={
                          title.trim() ? fieldState.error?.message : undefined
                        }
                      />
                      <Text style={styles.characterCount}>
                        {field.value.length}/2000 ký tự
                      </Text>
                    </>
                  );
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                onPress={() => setActive(null)}
              >
                Xong
              </Button>
            </View>
          )}
        </View>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        variant="secondary"
        disabled={disabled || fields.length >= 100}
        style={styles.add}
        onPress={() => {
          setActive(fields.length);
          append({ content: "" });
        }}
      >
        + Thêm buổi học
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  characterCount: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
    alignSelf: "flex-end",
  },
  group: { gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  label: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
  required: { color: colors.primary },
  count: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: appRadius.badge,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  active: {
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  number: {
    width: 28,
    height: 28,
    borderRadius: appRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  numberText: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    gap: 3,
  },
  title: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  icon: {
    width: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  editor: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  add: {
    borderStyle: "dashed",
    minHeight: 48,
    backgroundColor: colors.surface,
  },
  error: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
});
