import { View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { caseThreadStyles as s } from "./case-thread.styles";

export function CaseMessageComposer({
  value,
  onChange,
  onSend,
  pending,
  uncertain,
}: Readonly<{
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  pending: boolean;
  uncertain: boolean;
}>) {
  return (
    <View style={s.composer}>
      <View style={s.inputGroup}>
        <Input
          label="Nội dung bổ sung"
          hideLabel
          reserveMessageSpace={false}
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={4000}
          placeholder="Nhắn cho nhân viên hỗ trợ…"
          fieldStyle={s.inputField}
          style={s.input}
          editable={!pending && !uncertain}
          submitBehavior="newline"
        />
      </View>
      <Button
        variant="forest"
        accessibilityLabel="Gửi phản hồi"
        accessibilityState={{ busy: pending }}
        style={s.send}
        disabled={!value.trim() || pending || uncertain}
        onPress={onSend}
      >
        <Icon
          name={pending ? "clock" : "send"}
          size={18}
          color={appColors.white}
        />
      </Button>
    </View>
  );
}
