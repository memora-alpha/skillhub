import type { FilePurpose, StoredFileState } from "./file.types";

export type StoredFileRecord = {
  id: string;
  purpose: FilePurpose;
  uploadedBy: string;
  objectKey: string;
  generation: number;
  originalName: string;
  detectedMime?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  state: StoredFileState;
};

export interface StoredFileRepository {
  createUploading(row: Omit<StoredFileRecord, "state">): Promise<void>;
  /** Must atomically CAS UPLOADING -> QUARANTINED and persist FILE_SCAN_REQUESTED outbox. */
  finalize(input: {
    id: string;
    generation: number;
    detectedMime: string;
    sizeBytes: number;
    sha256: string;
    correlationId: string;
  }): Promise<void>;
  failUpload(id: string): Promise<void>;
  find(id: string): Promise<StoredFileRecord | null>;
}

export const STORED_FILE_REPOSITORY = Symbol("STORED_FILE_REPOSITORY");
