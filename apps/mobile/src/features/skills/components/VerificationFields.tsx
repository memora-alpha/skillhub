import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { useVerificationForm } from "../hooks/use-verification-form";
import { EvidenceFiles } from "./EvidenceFiles";
import { EvidencePicker } from "./EvidencePicker";
import { skillStyles } from "./SkillsLayout";

export function VerificationFields({
  model,
  saved,
}: {
  model: ReturnType<typeof useVerificationForm>;
  saved: boolean;
}) {
  const { draft, busy } = model;
  return (
    <View style={{ gap: 14 }}>
      <EvidencePicker
        disabled={busy || draft.files.length >= 5}
        picking={model.picking}
        onPick={(source) => void model.pick(source)}
      />
      <EvidenceFiles
        files={draft.files}
        disabled={busy}
        onRemove={(localId) => {
          if (!model.locked())
            draft.setFiles((files) =>
              files.filter((file) => file.localId !== localId),
            );
        }}
      />
      {!saved && !!draft.files.length && (
        <Text style={skillStyles.caption}>
          Lưu kỹ năng trước khi gửi bằng chứng.
        </Text>
      )}
      {!!draft.files.length && (
        <>
          <Input
            label="Tiêu đề (tùy chọn)"
            value={model.title}
            onChangeText={model.setTitle}
            editable={!busy}
            placeholder="Chứng chỉ hoặc dự án"
            error={model.titleInvalid ? "Tiêu đề quá 120 ký tự." : undefined}
          />
          <Input
            label="Mô tả (tùy chọn)"
            value={model.description}
            onChangeText={model.setDescription}
            editable={!busy}
            multiline
            placeholder="Mô tả ngắn về bằng chứng"
            error={
              model.descriptionInvalid ? "Mô tả quá 500 ký tự." : undefined
            }
          />
        </>
      )}
      {saved && (
        <Button
          variant="craft"
          style={{ borderRadius: 12 }}
          disabled={
            busy ||
            !draft.files.length ||
            model.titleInvalid ||
            model.descriptionInvalid
          }
          onPress={() => void model.submit()}
        >
          {model.action.pending
            ? "Đang gửi yêu cầu…"
            : model.preparing
              ? "Đang xử lý bằng chứng…"
              : "Gửi yêu cầu xác minh"}
        </Button>
      )}
    </View>
  );
}
