export abstract class AvatarStoragePort {
  abstract put(key: string, data: Buffer, mime: string): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
  abstract remove(key: string): Promise<void>;
  abstract url(key: string): Promise<string>;
}
export abstract class AvatarScannerPort {
  abstract scan(data: Buffer): Promise<boolean>;
}
export abstract class AvatarInspector {
  abstract inspect(data: Buffer): Promise<string>;
}
export abstract class AvatarJobs {
  abstract enqueue(id: string): Promise<void>;
}
