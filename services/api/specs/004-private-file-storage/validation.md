# SH-004 validation

Date: 2026-10-05. Status: implemented in source; the technical lifecycle is
verified on PostgreSQL 17.11 (Docker Compose, isolated database
`skillhub_test`). S3, ClamAV and BullMQ evidence is **Pending**. This report
separates fake-backed tests from real provider/runtime evidence.

## Approved values

- Evidence/report: 10,000,000 bytes per file, from the user's 2026-10-05 answer.
- Chat: 15,000,000 bytes per file from SRS v1.4.
- Malware scanner: ClamAV clamd INSTREAM, approved by the user 2026-10-05.
- Signed GET: configuration snapshot default 120 seconds, max 300 seconds.

## Checks run (API workspace, 2026-10-05)

| Check                                      | Result                           |
| ------------------------------------------ | -------------------------------- |
| `pnpm build`, `tsc --noEmit`, `pnpm lint`  | Pass                             |
| `pnpm test:files`                          | Pass, 25/25                      |
| `pnpm test:files:integration` (PostgreSQL) | Pass, 4/4                        |
| Real `AppModule` boot with `StorageModule` | Pass, readiness 200, storage off |

What the integration suite proved on PostgreSQL, using the real
`PrismaStoredFileRepository` with fixture object storage and scanner (so it is
not S3 or ClamAV evidence):

- Finalize commits QUARANTINED and exactly one `file.scan.requested` outbox
  row, or neither; a second finalize is a state conflict and adds no event.
- Cleanup and finalize exclude each other through the state CAS: a finalized
  upload is never a cleanup candidate, and a claimed upload cannot finalize.
- A live scan lease blocks a duplicate worker. After a worker crash the expired
  lease is recovered, the scan is re-requested, and the crashed worker's stale
  verdict cannot write. Only CLEAN reaches READY; READY is immutable in the
  database; a duplicate job is a no-op.
- A scanner outage fails closed as SCAN_FAILED after three attempts with scan
  history; a requeue returns to QUARANTINED and still needs a real verdict.

What `test:files` covers, all with in-memory repositories/objects:

- Policy and detector: allowlist per purpose, extension/MIME/content mismatch,
  OOXML/OLE inspection, encrypted or malformed containers, size caps.
- Upload: server-generated key, streamed cap, private readback with hash and
  format validation before finalize; invalid uploads never finalize.
- Scan: only CLEAN reaches READY, INFECTED is rejected, UNKNOWN fails closed
  after three attempts, size mismatch is never CLEAN.
- Download: policy runs before any metadata read; only READY is signed; TTL
  comes from the snapshot; attachment name is header-safe; a replaced object is
  not signed. `file-access-http.test.mjs` runs a fixture consumer route behind
  the real guard chain: outsider, ADMIN outsider and nested-parent mismatch get
  404, a pending file gets 409, and no object key reaches the response.
- ClamAV framing against a same-process mock clamd (not a real scanner), and
  S3 presign parameters without a network call.

## Fixed during validation

- `FileStorageError` was a plain `Error`, so the API error filter turned every
  404/409/413/415 into a 500 for any consumer route. It now extends
  `HttpException`; the HTTP fixture test covers it.
- `StorageModule` was not imported by `AppModule`, so the scan publisher, scan
  worker and reconciler never started. It is imported now. With
  `STORAGE_ENABLED=false` the publisher and reconciler stay idle and object
  storage fails closed.

## Pending runtime gates

- S3 private bucket: put/read/head/delete, anonymous GET denied, presigned GET
  expiry, overwrite controls. No `TEST_S3_*` environment exists.
- ClamAV with a benign fixture and EICAR; definitions, `StreamMaxLength` and
  timeout behavior. No `TEST_CLAMAV_*` environment exists.
- Queue/outbox delivery and recovery against Redis/BullMQ.
- Real consumer routes and module-owned bindings/participant authorization
  when verification, conversation and report modules exist. There is no generic
  download route.
- OP-04 retention is unresolved; READY files are not auto-deleted.

## Parser trade-off

ZIP central directory/content-type validation is bounded; OLE `cfb` materializes a
file already capped at 10 MB evidence/report or 15 MB chat. A strict 1 MiB total
parser-memory budget from the initial technical proposal is therefore not met for
legacy DOC/XLS/PPT. Additional entry count (1,000) and expanded size
min(10×input,100 MB) guards reject abnormal containers after parse. Measure peak
heap at the cap and consider an isolated bounded parser before high-volume uploads.

## Handoff

SH-024/025/044/090/120 own their bindings, counts, DTOs and routes. A consumer
authorizes the upload, picks the purpose from its route, and passes its own
`FileAccessPolicy` to `issueDownload`. A READY scan does not make evidence
VERIFIED; that decision stays in the verification module.
