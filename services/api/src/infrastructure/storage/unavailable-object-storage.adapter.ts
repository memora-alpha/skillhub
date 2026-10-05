import { FileStorageError } from "./file.types";
import type { ObjectStorage } from "./object-storage.port";

/** Explicitly fail closed until the S3-compatible adapter is installed and configured. */
export class UnavailableObjectStorage implements ObjectStorage {
  private unavailable(): never {
    throw new FileStorageError("FILE_STORAGE_UNAVAILABLE", 503);
  }
  async put(): Promise<void> {
    this.unavailable();
  }
  async read(): Promise<never> {
    this.unavailable();
  }
  async head(): Promise<never> {
    this.unavailable();
  }
  async remove(): Promise<void> {
    this.unavailable();
  }
  async signGet(): Promise<string> {
    this.unavailable();
  }
}
