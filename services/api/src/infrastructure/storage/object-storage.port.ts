import type { Readable } from "node:stream";

export interface ObjectStorage {
  put(
    key: string,
    body: Readable,
    mime: string,
    signal?: AbortSignal,
  ): Promise<void>;
  read(key: string, signal?: AbortSignal): Promise<Readable>;
  head(
    key: string,
    signal?: AbortSignal,
  ): Promise<{ size: number; versionId?: string } | null>;
  remove(key: string): Promise<void>;
  signGet(
    key: string,
    input: {
      expiresInSeconds: number;
      disposition: string;
      mime: string;
    },
  ): Promise<string>;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
