"use client";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { Feedback } from "../components/common";

type AvatarStatus = {
  assetId: string;
  status: "QUARANTINED" | "CLEAN" | "REJECTED" | "DELETED";
};
import { avatarFileError } from "./avatar-policy";
function checkedStatus(value: AvatarStatus, expectedId?: string) {
  if (
    !value ||
    !/^[0-9a-f-]{36}$/i.test(value.assetId) ||
    (expectedId && value.assetId !== expectedId) ||
    !["QUARANTINED", "CLEAN", "REJECTED", "DELETED"].includes(value.status)
  )
    throw new Error(
      "Chưa đọc được trạng thái ảnh hợp lệ. Kiểm tra hồ sơ trước khi tải ảnh khác.",
    );
  return value;
}
export function AvatarEditor({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const { request, refresh } = useUserSession();
  const [file, setFile] = useState<File>();
  const [assetId, setAssetId] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedCallback = useRef(onSaved);
  useEffect(() => {
    savedCallback.current = onSaved;
  }, [onSaved]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!assetId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let reads = 0;
    async function check() {
      if (controller.signal.aborted || document.hidden) return;
      setChecking(true);
      try {
        const value = checkedStatus(
          (
            await request<AvatarStatus>("me/avatar/uploads/" + assetId, {
              signal: controller.signal,
            })
          ).data,
          assetId,
        );
        if (controller.signal.aborted) return;
        setError(undefined);
        if (value.status === "CLEAN") {
          setNotice("Ảnh đã quét sạch và được cập nhật vào hồ sơ.");
          setAssetId(undefined);
          refresh();
          savedCallback.current();
        } else if (value.status !== "QUARANTINED") {
          setNotice(
            value.status === "REJECTED"
              ? "Ảnh không được chấp nhận. Hãy chọn ảnh khác."
              : "Ảnh đã được xóa hoặc thay thế.",
          );
          setAssetId(undefined);
        } else if (++reads < 24) {
          setNotice(
            "Đang quét ảnh. Ảnh cũ vẫn hiển thị cho tới khi máy chủ xác nhận ảnh mới sạch.",
          );
          timer = setTimeout(() => void check(), 5000);
        } else
          setNotice(
            "Ảnh vẫn đang được xử lý. Bạn có thể kiểm tra lại, không cần tải lại tệp.",
          );
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Chưa kiểm tra được ảnh.",
          );
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }
    const resume = () => {
      if (!document.hidden) setAttempt((value) => value + 1);
    };
    document.addEventListener("visibilitychange", resume);
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [assetId, attempt, request, refresh]);
  return (
    <div className="learner-form">
      <h3>Ảnh đại diện</h3>
      <label>
        <span>JPEG, PNG hoặc WebP · tối đa 5 MB</span>
        <input
          type="file"
          ref={fileInput}
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading || !!assetId}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setFile(selected);
            setNotice(undefined);
            setError(selected ? avatarFileError(selected) : undefined);
          }}
        />
      </label>
      <div className="learner-actions">
        <button
          type="button"
          className="btn"
          disabled={!file || !!avatarFileError(file) || uploading || !!assetId}
          onClick={async () => {
            if (!file || busy.current || avatarFileError(file)) return;
            const signal = lifetime.current?.signal;
            busy.current = true;
            setUploading(true);
            setError(undefined);
            try {
              const body = new FormData();
              body.set("image", file);
              const value = checkedStatus(
                (
                  await request<AvatarStatus>("me/avatar", {
                    method: "POST",
                    body,
                    signal,
                  })
                ).data,
              );
              if (signal?.aborted) return;
              setFile(undefined);
              if (fileInput.current) fileInput.current.value = "";
              setAssetId(value.assetId);
              setAttempt((value) => value + 1);
            } catch (cause) {
              if (!signal?.aborted)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Chưa xác nhận được kết quả tải ảnh. Kiểm tra hồ sơ trước khi thử lại.",
                );
            } finally {
              busy.current = false;
              if (!signal?.aborted) setUploading(false);
            }
          }}
        >
          {uploading ? "Đang xử lý…" : "Tải ảnh lên"}
        </button>
        {assetId && (
          <button
            type="button"
            className="btn"
            disabled={uploading || checking}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Kiểm tra trạng thái ảnh
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={uploading}
          onClick={async () => {
            if (busy.current) return;
            const signal = lifetime.current?.signal;
            busy.current = true;
            setUploading(true);
            setError(undefined);
            try {
              await request("me/avatar", { method: "DELETE", signal });
              if (signal?.aborted) return;
              setAssetId(undefined);
              setFile(undefined);
              if (fileInput.current) fileInput.current.value = "";
              setNotice("Đã xóa ảnh đại diện và hủy ảnh đang chờ xử lý.");
              refresh();
              onSaved();
            } catch (cause) {
              if (!signal?.aborted)
                setError(
                  cause instanceof Error ? cause.message : "Chưa xóa được ảnh.",
                );
            } finally {
              busy.current = false;
              if (!signal?.aborted) setUploading(false);
            }
          }}
        >
          Xóa ảnh đại diện
        </button>
      </div>
      <Feedback error={error} />
      {notice && (
        <p className="learner-notice">
          <output>{notice}</output>
        </p>
      )}
    </div>
  );
}
