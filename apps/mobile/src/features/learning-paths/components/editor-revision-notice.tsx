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
        Nội dung đã được cập nhật. Phần đang nhập vẫn được giữ lại. Tải nội dung
        mới sẽ thay phần đang nhập.
      </FormNotice>
      <Button
        variant="secondary"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onReload();
        }}
      >
        Tải nội dung mới
      </Button>
    </>
  );
}
