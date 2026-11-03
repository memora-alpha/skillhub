import { useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { Button } from "./Button";
import { Copy } from "./feature-page";
import { FormNotice } from "./FormNotice";
import { uploadBody, type UploadedFile } from "@/lib/http/file-upload";
import { errorMessage } from "@/lib/http/errors";

export function ServerFilePicker({
  files,
  onChange,
  upload,
  status,
  isCurrent,
  maxCount = 5,
  maxBytes = 10_000_000,
  disabled = false,
  types = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
}: Readonly<{
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  upload: (body: FormData) => Promise<{ fileId: string; state: string }>;
  status: (id: string) => Promise<{ fileId: string; state: string }>;
  isCurrent: () => boolean;
  maxCount?: number;
  maxBytes?: number;
  disabled?: boolean;
  types?: string[];
}>) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>();
  async function work(task: () => Promise<void>) {
    if (lock.current || disabled || !isCurrent()) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      if (isCurrent()) setError(errorMessage(cause));
    } finally {
      lock.current = false;
      if (isCurrent()) setPending(false);
    }
  }
  return (
    <>
      {files.map((file) => (
        <Copy key={file.fileId}>
          {file.name}: {file.state === "READY" ? "Sẵn sàng" : file.state}
        </Copy>
      ))}
      <Copy muted>
        Tối đa {maxCount} tệp, {maxBytes / 1_000_000} MB/tệp. Tệp cần được quét
        an toàn trước khi gửi.
      </Copy>
      {error && <FormNotice tone="error">{error}</FormNotice>}
      <Button
        variant="paper"
        disabled={disabled || pending || files.length >= maxCount}
        onPress={() => {
          void work(async () => {
            const result = await DocumentPicker.getDocumentAsync({
              type: types,
              multiple: false,
              copyToCacheDirectory: true,
            });
            if (result.canceled || !isCurrent()) return;
            const file = result.assets[0]!;
            if (!file.size || file.size > maxBytes) {
              setError(`Chọn tệp từ 1 byte đến ${maxBytes / 1_000_000} MB.`);
              return;
            }
            const receipt = await upload(uploadBody(file));
            if (isCurrent())
              onChange([...files, { ...receipt, name: file.name }]);
          });
        }}
      >
        {pending ? "Đang xử lý tệp…" : "Chọn và tải tệp lên"}
      </Button>
      {!!files.length && (
        <Button
          variant="paper"
          disabled={disabled || pending}
          onPress={() => {
            void work(async () => {
              const checked = await Promise.all(
                files.map(async (file) => ({
                  ...file,
                  ...(await status(file.fileId)),
                })),
              );
              if (isCurrent()) onChange(checked);
            });
          }}
        >
          Kiểm tra trạng thái tệp
        </Button>
      )}
      {!!files.length && (
        <Button
          variant="ghost"
          disabled={disabled || pending}
          onPress={() => onChange([])}
        >
          Bỏ các tệp đã chọn
        </Button>
      )}
    </>
  );
}
