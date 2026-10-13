"use client";
import { useEffect, useId, useRef, useState } from "react";
import { isSessionFailure, staffFile } from "@/lib/staff/client";
import {
  evidenceFilename,
  evidencePreviewKind,
} from "@/lib/staff/evidence-file";
import { useStaffSession } from "./session";
function FileViewer({
  path,
  name,
  onClose,
}: {
  path: string;
  name: string;
  onClose: () => void;
}) {
  const { portal, expire } = useStaffSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<{ url: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const id = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const contentPath = path.replace(/\/download$/, "/content");
    staffFile(contentPath, portal, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setFile({ url: objectUrl, mime: blob.type });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (isSessionFailure(err)) expire();
        setError(err instanceof Error ? err.message : "Không thể mở tệp.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, portal, expire, revision]);
  const kind = file ? evidencePreviewKind(file.mime) : null;
  return (
    <dialog
      ref={dialog}
      className="dialog file-viewer"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="file-viewer-head">
        <div>
          <h2 id={`${id}-title`}>{name}</h2>
          <p className="muted">
            Xem trực tuyến · Tải xuống khi bạn muốn lưu tệp
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={onClose}
          aria-label="Đóng cửa sổ xem tệp"
        >
          Đóng
        </button>
      </header>
      <div className="file-viewer-body">
        {error ? (
          <div className="staff-state">
            <p className="staff-error" role="alert">
              {error}
            </p>
            <button
              className="btn"
              onClick={() => {
                setFile(null);
                setError(null);
                setFailed(false);
                setRevision((r) => r + 1);
              }}
            >
              Thử lại
            </button>
          </div>
        ) : !file ? (
          <p className="staff-state" role="status">
            Đang mở tệp…
          </p>
        ) : (
          <>
            {kind === "image" && !failed && (
              <div className="file-viewer-image">
                {/* Original evidence bytes; Next image optimization would require a public file URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={name}
                  onError={() => setFailed(true)}
                />
              </div>
            )}
            {kind === "pdf" && (
              <object
                className="file-viewer-pdf"
                data={file.url}
                type="application/pdf"
                aria-label={`Xem PDF: ${name}`}
              >
                <p>
                  Trình duyệt này chưa hiển thị được PDF. Bạn có thể mở PDF
                  trong tab mới hoặc chọn tải xuống.
                </p>
              </object>
            )}
            {(kind === "unsupported" || failed) && (
              <p className="staff-state">
                {failed
                  ? "Không thể hiển thị ảnh này."
                  : "Định dạng này chưa hỗ trợ xem trực tuyến trong trình duyệt."}{" "}
                Bạn có thể chọn tải xuống để xem trên máy.
              </p>
            )}
          </>
        )}
      </div>
      <footer className="file-viewer-foot">
        {file && (
          <>
            {kind !== "unsupported" && !failed && (
              <a
                className="btn"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Xem trong tab mới ↗
              </a>
            )}
            <a
              className="btn btn-primary"
              href={file.url}
              download={evidenceFilename(name, file.mime)}
            >
              Tải xuống
            </a>
          </>
        )}
      </footer>
    </dialog>
  );
}
export function EvidenceFileButton({
  path,
  name = "Bằng chứng",
}: {
  path: string;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="staff-download">
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Xem trực tuyến
      </button>
      {open && (
        <FileViewer path={path} name={name} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
