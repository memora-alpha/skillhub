import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { useVerificationForm } from "../hooks/use-verification-form";
import { EvidenceFiles } from "./EvidenceFiles";
import { EvidencePicker } from "./EvidencePicker";
import { skillStyles } from "./SkillsLayout";
import { keepOriginalEvidence } from "../utils/compress-evidence";

export function VerificationFields({
  model,
  saved,
  saveWithSkill = false,
}: Readonly<{
  model: ReturnType<typeof useVerificationForm>;
  saved: boolean;
  saveWithSkill?: boolean;
}>) {
  const { draft, busy } = model;
  let submitLabel = "Gửi yêu cầu xác minh";
  if (model.preparing) submitLabel = "Đang xử lý bằng chứng…";
  else if (model.waitingScan) submitLabel = "Kiểm tra và gửi yêu cầu";
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
        onOriginalChange={(localId, original) => {
          if (!model.locked())
            draft.setFiles((files) =>
              files.map((file) =>
                file.localId === localId
                  ? keepOriginalEvidence(file, original)
                  : file,
              ),
            );
        }}
      />
      {model.waitingScan && (
        <Text style={skillStyles.caption}>
          Bằng chứng đã tải lên và đang được kiểm tra. Không cần chọn hoặc tải
          lại file.
        </Text>
      )}
      {saveWithSkill && !!draft.files.length && (
        <Text style={skillStyles.caption}>
          Bằng chứng sẽ được gửi khi lưu kỹ năng.
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
      {saved && !saveWithSkill && (
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
          {submitLabel}
        </Button>
      )}
    </View>
  );
}
