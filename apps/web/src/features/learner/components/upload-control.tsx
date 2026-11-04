"use client";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { Feedback } from "./common";
export function UploadControl({
  endpoint,
  maxBytes,
  accept,
  onUploaded,
  disabled = false,
}: {
  endpoint: string;
  maxBytes: number;
  accept: string;
  onUploaded: (id: string) => void;
  disabled?: boolean;
}) {
  const { request } = useUserSession(),
    busy = useRef(false);
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState<string>();
  return (
    <div>
      <label>
        Tệp tài liệu
        <input
          aria-label="Chọn tệp tải lên"
          type="file"
          accept={accept}
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || busy.current) return;
            if (file.size > maxBytes || file.size === 0) {
              setError(
                "Tệp phải có nội dung và không quá " +
                  maxBytes / 1000000 +
                  " MB.",
              );
              e.target.value = "";
              return;
            }
            busy.current = true;
            setUploading(true);
            setError(undefined);
            const data = new FormData();
            data.set("file", file);
            void request<{ fileId: string }>(endpoint, {
              method: "POST",
              body: data,
            })
              .then((result) => {
                if (!/^[0-9a-f-]{36}$/i.test(result.data?.fileId))
                  throw new Error("Phản hồi tệp chưa hợp lệ.");
                onUploaded(result.data.fileId);
              })
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "Chưa tải được tệp.",
                ),
              )
              .finally(() => {
                busy.current = false;
                setUploading(false);
              });
          }}
        />
      </label>
      <small>
        Tối đa {maxBytes / 1000000} MB. Tệp được máy chủ kiểm tra trước khi sử
        dụng.
      </small>
      <Feedback loading={uploading} error={error} />
    </div>
  );
}
