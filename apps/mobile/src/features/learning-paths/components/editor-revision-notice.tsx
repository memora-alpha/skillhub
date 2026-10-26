import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";

export function EditorRevisionNotice({
  visible,
  disabled,
  onReload,
}: Readonly<{
  visible: boolean;
  disabled: boolean;
  onReload: () => void;
}>) {
  if (!visible) return null;
  return (
    <>
      <FormNotice tone="info" compact>
        Có bản mới. Bản đang nhập được giữ lại, chưa thể gửi. Mở bản mới sẽ thay
        nội dung này.
      </FormNotice>
      <Button
        variant="secondary"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onReload();
        }}
      >
        Mở nội dung phiên bản mới
      </Button>
    </>
  );
}
