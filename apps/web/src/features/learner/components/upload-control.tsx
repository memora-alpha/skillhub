"use client";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { Feedback } from "./common";
export function UploadControl({
  endpoint,
  maxBytes,
  accept,
  onUploaded,
  disabled = false,
  label = "Tệp tài liệu",
  onBusyChange,
}: Readonly<{
  endpoint: string;
  maxBytes: number;
  accept: string;
  onUploaded: (id: string) => void;
  disabled?: boolean;
  label?: string;
  onBusyChange?: (busy: boolean) => void;
}>) {
  const { request } = useUserSession(),
    busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState<string>();
  return (
    <div>
      <label>
        <span>{label}</span>
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
            onBusyChange?.(true);
            setError(undefined);
            const data = new FormData();
            data.set("file", file);
            void request<{ fileId: string }>(endpoint, {
              method: "POST",
              body: data,
            })
              .then((result) => {
                if (!alive.current) return;
                if (!/^[0-9a-f-]{36}$/i.test(result.data?.fileId))
                  throw new Error("Phản hồi tệp chưa hợp lệ.");
                onUploaded(result.data.fileId);
              })
              .catch((cause: unknown) => {
                if (!alive.current) return;
                setError(
                  cause instanceof Error ? cause.message : "Chưa tải được tệp.",
                );
              })
              .finally(() => {
                busy.current = false;
                if (alive.current) {
                  setUploading(false);
                  onBusyChange?.(false);
                }
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
