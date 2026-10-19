import { HttpException } from "@nestjs/common";

export type FilePurpose = "EVIDENCE" | "CHAT" | "REPORT" | "MATERIAL";

export type StoredFileState =
  | "UPLOADING"
  | "QUARANTINED"
  | "SCANNING"
  | "READY"
  | "REJECTED"
  | "SCAN_FAILED"
  | "UPLOAD_FAILED"
  | "CLEANUP_PENDING"
  | "DELETED";

export type ValidatedFileFormat = {
  extension: string;
  detectedMime: string;
  sizeBytes: number;
  safeName: string;
};

/** HttpException so consumer routes keep the status/code through the API error envelope. */
export class FileStorageError extends HttpException {
  constructor(
    readonly code: string,
    status: 400 | 404 | 409 | 413 | 415 | 503,
  ) {
    super(code, status);
  }
}
