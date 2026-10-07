import type { ScanVerdict } from "./malware-scanner.port";

export type ScanClaim = {
  id: string;
  generation: number;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  attempt: number;
  leaseToken: string;
};

export interface ScanRepository {
  claim(fileId: string, generation: number): Promise<ScanClaim | null>;
  complete(input: {
    claim: ScanClaim;
    verdict: ScanVerdict;
    scannerVersion: string;
  }): Promise<boolean>;
  currentState(fileId: string): Promise<string | null>;
  requeueFailed(fileId: string, correlationId: string): Promise<void>;
}
