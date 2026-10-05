import type { ObjectStorage } from "./object-storage.port";
import type { MalwareScanner, ScanVerdict } from "./malware-scanner.port";
import type { ScanRepository } from "./scan-repository.port";

export class FileScanProcessor {
  constructor(
    private readonly repository: ScanRepository,
    private readonly objects: Pick<ObjectStorage, "head" | "read">,
    private readonly scanner: MalwareScanner,
  ) {}

  async process(fileId: string, generation: number): Promise<string> {
    const claim = await this.repository.claim(fileId, generation);
    if (!claim) {
      const state = await this.repository.currentState(fileId);
      if (state === "READY" || state === "REJECTED" || state === "SCAN_FAILED")
        return state;
      throw new Error("FILE_SCAN_RETRY");
    }
    let verdict: ScanVerdict = "UNKNOWN";
    let scannerVersion = "unavailable";
    try {
      const head = await this.objects.head(claim.objectKey);
      if (head && head.size === claim.sizeBytes) {
        const result = await this.scanner.scan({
          body: await this.objects.read(claim.objectKey),
          expectedSha256: claim.sha256,
        });
        verdict = result.verdict;
        scannerVersion = result.scannerVersion;
      }
    } catch {
      // Provider or scanner failure is an UNKNOWN verdict, never a clean file.
    }
    const applied = await this.repository.complete({
      claim,
      verdict,
      scannerVersion,
    });
    if (!applied) {
      const state = await this.repository.currentState(fileId);
      if (state === "READY" || state === "REJECTED" || state === "SCAN_FAILED")
        return state;
      throw new Error("FILE_SCAN_RETRY");
    }
    if (verdict === "CLEAN") return "READY";
    if (verdict === "INFECTED") return "REJECTED";
    if (claim.attempt >= 3) return "SCAN_FAILED";
    throw new Error("FILE_SCAN_RETRY");
  }
}
