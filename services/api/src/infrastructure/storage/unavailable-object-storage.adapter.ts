import { FileStorageError } from "./file.types";
import type { ObjectStorage } from "./object-storage.port";

/** Explicitly fail closed until the S3-compatible adapter is installed and configured. */
export class UnavailableObjectStorage implements ObjectStorage {
  private unavailable(): Promise<never> {
    return Promise.reject(
      new FileStorageError("FILE_STORAGE_UNAVAILABLE", 503),
    );
  }
  put(): Promise<void> {
    return this.unavailable();
  }
  read(): Promise<never> {
    return this.unavailable();
  }
  head(): Promise<never> {
    return this.unavailable();
  }
  remove(): Promise<void> {
    return this.unavailable();
  }
  signGet(): Promise<string> {
    return this.unavailable();
  }
}
