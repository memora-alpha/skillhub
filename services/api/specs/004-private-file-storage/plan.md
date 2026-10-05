# SH-004 Private file storage và upload validation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` triển khai task-by-task. Không commit/push hoặc tạo provider resource khi chưa có yêu cầu tương ứng.

**Goal:** Upload private có actual-format/size validation, scan fail-closed và
download ngắn hạn sau resource authorization, có recovery khi stores/queue lỗi.
**Architecture:** Backend streaming → private object → metadata/outbox tx →
module scan worker → READY. Domain modules sở hữu bindings/access policies.
**Tech Stack:** NestJS 11, Prisma/PostgreSQL, S3-compatible AWS SDK v3 adapter,
ClamAV INSTREAM, BullMQ và Node streams; detector/container parser chọn bản
tương thích CJS build của repo và lock dependency khi implementation.
**Spec:** [spec.md](spec.md). **Date:** 2026-10-04. **Status:** Implemented 2026-10-05; lifecycle đã kiểm chứng trên PostgreSQL, S3/ClamAV/BullMQ còn Pending — xem [validation.md](validation.md).
Paths tính từ `services/api`.

## Global Constraints

- Constitution v1.2.0; file bytes ở S3, technical lifecycle ở PostgreSQL;
  Message/binding ownership vẫn theo module và accepted storage boundaries.
- Chat `<= 15.000.000 bytes`; evidence/report cap chưa chốt không lấy 10 MB từ v1.3.
- No public object/no clean-by-default scanner/no external provider call trong tx.
- Actual streams bounded; rights từ server/module, không từ client owner/purpose.
- Signed URL default120/max300 s là technical proposal; đã cấp có bearer TTL.
- Real tests chỉ test bucket/database/queue/scanner riêng; không xóa files production.

## Review Focus

1. ZIP/OLE spoofing, MIME mismatch, oversized streamed body: reject trước READY (Task 1/2).
2. Scan outage hoặc stale verdict: file vẫn private, không mở generation sai (Task 3).
3. Object put/DB/queue crash gaps: recover không mất scan hoặc publish file sớm (Task 2/3).
4. Parent/child sai hoặc ADMIN outsider: không signed URL (Task 4).
5. Orphan cleanup racing finalize và URL leakage: không xóa file hợp lệ/log bearer (Task 4/5).

## Files và interfaces

| Create                                                                            | Trách nhiệm                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/infrastructure/storage/file.types.ts`                                        | FilePurpose/state/metadata/access contract           |
| `src/infrastructure/storage/file-policy.ts`                                       | Allowlist/cap, extension và detected format checks   |
| `src/infrastructure/storage/file-format-detector.ts`                              | Bounded magic/OOXML/OLE/text validation              |
| `src/infrastructure/storage/object-storage.port.ts`                               | Private stream put/read/head/delete/signed GET       |
| `src/infrastructure/storage/s3-object-storage.adapter.ts`                         | S3 SDK adapter, generated keys, private access       |
| `src/infrastructure/storage/stored-file.repository.ts`                            | Technical lifecycle/scan lease persistence           |
| `src/infrastructure/storage/file-storage.service.ts`                              | Upload finalize và authorized download orchestration |
| `src/infrastructure/storage/malware-scanner.port.ts`, `clamav-scanner.adapter.ts` | CLEAN/INFECTED/UNKNOWN verdict đúng hash/generation  |
| `src/infrastructure/storage/file-scan.processor.ts`                               | Lease, bounded attempts và verdict CAS               |
| `src/infrastructure/storage/file-reconciler.ts`, `storage.module.ts`              | Incomplete-upload recovery, DI exports               |

```ts
type FilePurpose = "EVIDENCE" | "CHAT" | "REPORT";
type ValidatedFileFormat = {
  extension: string; detectedMime: string; sizeBytes: number;
};
validateFile(input: {
  purpose: FilePurpose; name: string; claimedMime: string;
  detectedMime: string; sizeBytes: number; capBytes: number;
}): ValidatedFileFormat;
FileFormatDetector.inspect(input: {
  body: Readable; name: string; purpose: FilePurpose; capBytes: number;
}): Promise<{ detectedMime: string; sizeBytes: number; sha256: string }>;
interface ObjectStorage {
  put(key: string, body: Readable, mime: string): Promise<void>;
  read(key: string): Promise<Readable>;
  head(key: string): Promise<{ size: number; versionId?: string } | null>;
  remove(key: string): Promise<void>;
  signGet(key: string, input: {
    expiresInSeconds: number; disposition: string; mime: string;
  }): Promise<string>;
}
interface MalwareScanner {
  scan(input: { body: Readable; expectedSha256: string }): Promise<{
    verdict: "CLEAN" | "INFECTED" | "UNKNOWN"; scannerVersion: string;
  }>;
}
interface FileAccessPolicy {
  assertRead(input: {
    actor: Actor; fileId: string; resource: { type: string; id: string };
  }): Promise<void>;
}
FileStorageService.upload(input: {
  actor: Actor; purpose: FilePurpose; name: string; claimedMime: string;
  body: Readable; context: RequestContext;
}): Promise<{ fileId: string; state: "QUARANTINED" }>;
FileStorageService.issueDownload(input: {
  actor: Actor; fileId: string; resource: { type: string; id: string };
}, policy: FileAccessPolicy): Promise<{ url: string; expiresAt: Date }>;
```

Module caller authorizes upload trước gọi service và chọn purpose từ route;
FileAccessPolicy lấy qua module DI, không từ body. Policy kiểm tra binding fileId
thuộc parent hiện hành, permissions/participants từ authoritative store.
Scanner adapter phải tính/kiểm digest của đúng stream; checksum mismatch UNKNOWN.
StorageModule chỉ export FileStorageService/consumer types; repository và raw
ObjectStorage adapter giữ private để consumer không tự overwrite object đã scan.

## Tasks

### Task 1: Policy và bounded format detector

**Create:** types/policy/detector ở bảng, `test/file-policy.test.mjs`.
**Consumes:** SH-006 typed cap snapshot. **Produces:**
`validateFile(input): ValidatedFileFormat` và limit Transform dùng actual bytes.

- [ ] Viết fixtures hợp lệ cho PDF/Office OLE/OOXML/images/TXT, extension/MIME
      mismatch, empty/executable/HTML/SVG, malformed/encrypted ZIP/OLE và oversized stream.
- [ ] Pin boundary chat15.000.000 pass/15.000.001 fail; evidence missing cap deny.
      Report dùng evidence policy; count1–5 không chuyển thành global file-service rule.
- [ ] RED rồi implement normalized final extension + signature/container validation;
      Office OLE nhận đúng WordDocument/Workbook/PowerPoint streams, OOXML kiểm đúng
      internal document type. Generic ZIP/OLE header chưa đủ để accept.
- [ ] Chọn detector/parser dependency thực cần, validate bounded parsing trước
      pin lockfile. Chốt operational container limits: tối đa 1.000 entries, expanded
      bytes không vượt min(10×stored size,100 MB); ZIP metadata budget khoảng 1 MiB.
      Legacy OLE dùng `cfb` materialize toàn file sau cap 10/15 MB nên parser memory
      có thể vượt 1 MiB. Đây là technical trade-off để kiểm tra stream DOC/XLS/PPT
      thay vì tin extension; cần đo memory trên file biên và cân nhắc isolated parser.
      Encrypted/uninspectable content reject. Đây không là product file-cap mới.
- [ ] Chạy fixtures including archive bomb; legacy Office phải được inspect thực,
      không fallback extension-only khi library không phân biệt. Content-Length giả
      không bypass stream limit; không buffer cả file trong process memory.

### Task 2: Private upload saga và storage persistence

**Create:** storage port/S3 adapter/repository/upload service/module ở bảng;
`prisma/migrations/<timestamp>_sh004_stored_files/migration.sql`,
`test/file-storage-persistence.test.mjs`, `test/s3-storage.test.mjs`.
**Modify:** schema, package.json/lockfile, app.module, env validators/example.
**Consumes:** Task 1, SH-005 runner/outbox, SH-006 env/policy.
**Produces:** private ObjectStorage adapter và upload result contract.

- [ ] Viết test S3 anonymous GET denied; generated key không phụ thuộc filename;
      `../../`/null/control chars không đi vào path/disposition; no public ACL.
- [ ] Add StoredFile model theo spec; tạo UPLOADING row trước provider call,
      stream private object + hash/size. Validate full format/container trên chính
      object đã ghi trước finalize; read stream/hash phải khớp upload. Invalid object
      vẫn private, được mark failed/cleanup. Failed stream abort request/multipart;
      dùng SDK lib-storage khi cần để không để multipart parts mồ côi.
- [ ] Finalize QUARANTINED metadata và FILE_SCAN_REQUESTED outbox cùng tx;
      event payload chỉ fileId/generation, correlationId từ SH-005.
- [ ] Test crash sau put/trước finalize: vẫn inaccessible; failure giữ technical
      row/recovery metadata, không giả rollback S3 khi DB tx fail.
- [ ] Add S3 client/presigner dependencies cần thiết, provider endpoint/bucket/region
      và credential env conditional STORAGE_ENABLED; production private/TLS controls
      theo S3-compatible provider, local test endpoint rõ ràng. Không tạo cloud bucket.
- [ ] Real adapter tests put/read/head/delete bounded trên bucket test; inspect
      logs không chứa credential/key URL và app không return object key cho client.

### Task 3: Durable scan và worker idempotency

**Create:** scanner port/ClamAV adapter/processor ở bảng;
`test/file-scan.test.mjs`, `test/file-scan-recovery.test.mjs`.
**Modify:** storage module/QueueModule wiring và outbox publisher registration.
**Consumes:** SH-005 dispatcher, ObjectStorage/read và StoredFile repository.
**Produces:** READY/REJECTED/SCAN_FAILED state, controlled `requeueScan(fileId)`.

- [ ] Viết CLEAN/INFECTED/UNKNOWN/error/timeout tests; no verdict không là CLEAN.
      Duplicate worker và stale generation verdict không overwrite current state.
- [ ] Implement ClamAV bounded INSTREAM trên private trusted network; timeout30 s,
      scanner size/parser limits đáp ứng file policies; version/definition health kiểm
      khi enabled. Test adapter thật với benign fixture và antivirus test signature.
- [ ] Worker claim state/lease CAS, lease60 s/max3 scan attempts; network call
      ngoài tx, apply verdict chỉ với cùng file generation/hash/lease token.
- [ ] Outbox publish vào dedicated scan queue, worker retry không ack success khi
      lease còn do worker khác giữ. Expired SCANNING lease được reclaim; stalled job
      phải retry/reconcile, không bị bỏ vì thấy SCANNING rồi return thành công.
- [ ] Test crash sau finalize/trước queue và sau scanner verdict/trước DB mark;
      outbox/worker recovery không bỏ scan, clean-object hash match trước READY.
- [ ] Test outage exhaust giữ SCAN_FAILED và error code safe; controlled requeue
      không accept client verdict và không cấp URL trước clean result mới.

### Task 4: Authorized signed download và consumer bindings

**Create:** `test/file-access-http.test.mjs`, `test/file-download.test.mjs`.
**Modify:** download method/service, future consumer routes SH-024/044/090.
**Consumes:** module-owned FileAccessPolicy, Clock/TTL, existing RBAC guard chain.
**Produces:** `{url,expiresAt}` chỉ cho READY và authorized resource binding.

- [ ] Viết owner/participant vs outsider/ADMIN outsider/nested-parent mismatch
      fixture tests; auth/participant readers thật phải được test khi consumer tồn tại.
- [ ] Execute module policy trước expose metadata/state, unauthorized/missing→404;
      only READY signs. Authenticated owner còn pending→409 và không có URL.
- [ ] Sign GET bằng TTL snapshot1–300 s, default120, safe attachment filename,
      detected MIME; consumer response dùng no-store và không log URL. Không cấp PUT.
- [ ] Real S3 test URL valid trước expiry/invalid sau expiry; revoke quyền chặn
      URL mới, ghi rõ existing URL TTL limitation. Không gọi sign endpoint “one-time”.
- [ ] Binding/usecase consumer giữ evidence PENDING dù file READY; attachment chỉ
      attach file đúng purpose/binding. Không mở generic route khi auth/domain chưa có.

### Task 5: Reconciliation, runtime checks và handoff

**Create:** reconciler ở bảng, `test/file-reconciliation.test.mjs`, `validation.md`.
**Modify:** README/package scripts/health nếu storage enabled cần readiness probe.
**Consumes:** repository/ObjectStorage/Clock. **Produces:** bounded cleanup/recovery.

- [ ] Cleanup UPLOADING/UPLOAD_FAILED quá grace24 h bằng CAS sang CLEANUP_PENDING;
      finalize chỉ CAS từ UPLOADING. Provider delete ngoài tx, retry giữ tombstone,
      success→DELETED. Không xóa READY vì không thấy binding
      ở module chưa tồn tại; READY retention vẫn OP-04.
- [ ] Test finalize/cleanup race không xóa object vừa finalize; dangling row/object
      không được sign và có diagnostic/recovery. Bucket cleanup chỉ server prefix test.
- [ ] Add `test:files` và `test:files:integration` build-before-test; latter yêu cầu
      test PostgreSQL/Redis/S3/ClamAV. No fake scanner/provider substitution trong report.
- [ ] Chạy lint/check-types/build, adapter/MIME/scan/URL/privacy/recovery tests;
      record Pending runtime credentials/env riêng nếu chưa có môi trường.
- [ ] Handoff SH-024/025/044/090/120: binding rights, count, DTO/route và scan state;
      metadata/business permissions thuộc module, không public file graph trong storage.

## Spec coverage

R-01/06 → Task 2; R-02/08 → Task 4 và consumer binding; R-03/04/05 → Task 1;
R-07/10 → Task 3; R-09 → Task 4; R-11 → Tasks 2/4/5; R-12 → Task 5.

## Verification commands

Từ `services/api`, `pnpm build` trước commands đọc dist; task RED phải fail vì
behavior chưa có, GREEN exit 0 với assertions đã nêu.

| Task | Command sau build                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec node --test test/file-policy.test.mjs`                                                                                         |
| 2    | `pnpm exec node --test test/file-storage-persistence.test.mjs test/s3-storage.test.mjs`                                                   |
| 3    | `pnpm exec node --test test/file-scan.test.mjs test/file-scan-recovery.test.mjs`                                                          |
| 4    | `pnpm exec node --test test/file-access-http.test.mjs test/file-download.test.mjs`                                                        |
| 5    | `pnpm exec node --test test/file-reconciliation.test.mjs`; API lint/check-types/build và `pnpm test:files`, `pnpm test:files:integration` |

Scripts Task 5 chưa có. Real suite dùng `TEST_DATABASE_URL`, `TEST_REDIS_URL`,
`TEST_S3_*` và `TEST_CLAMAV_*` cho isolated resources. Môi trường thiếu ghi
Pending; không thay real adapter tests bằng clean/scanner mock để báo pass.

## Constitution Check và Complexity Tracking

Ruling trong implementation: budget parser 1 MiB trong bản đề xuất ban đầu không
khả thi với `cfb` hiện dùng cho legacy Office. Upload stream vẫn capped trước khi
materialize; CFB input tối đa 10 MB evidence/report hoặc 15 MB chat, tối đa 1.000
entries và tổng extracted bytes tối đa min(10×input,100 MB). Chi phí là heap có thể
tăng theo file OLE; theo dõi memory và thay bằng parser cô lập/bounded nếu tải thực
tế cao. Không nới giới hạn file đã được duyệt.

| Principles | Design / evidence gate                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 1, 7       | Pass design: technical file lifecycle riêng, bindings/domain permissions do consumer sở hữu.               |
| 2, 3       | Pass design: no cross-store transaction; Pending upload saga/recovery evidence.                            |
| 4, 5       | Pass design: private, actual validation, signed TTL, secret env; Pending real object/rights/scan evidence. |
| 6, 8       | Pending DB/queue/S3/scanner crash/duplicate/stale-verdict tests; outbox delivery durable.                  |

Không có exception. Không thêm CDN/public media, resumable uploads, presigned PUT
hoặc universal attachment graph cho bản foundation này.

## References và handoff

[OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
[S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
và [ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html)
là references kỹ thuật; bounds/lifecycle ở đây là đề xuất riêng của SkillHub.
Signed URL có thể reuse tới expiry, nên quyền mới phải check trước mỗi issuance.

Task 1 làm trước độc lập; Tasks 2–5 cần SH-005/006. Evidence cap/production
provider/scanner và auth/domain bindings phải được chốt/có thật trước claim đầy đủ DoD.
