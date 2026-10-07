# Internal Contracts — planned additions and reuse

Paths relative to `services/api`. Signatures dưới đây là contract thiết kế, chưa phải source đã tồn tại.

## Existing integration points

- `SessionsService.principal(token)` và `assertLive(tx,principal)` xác thực session hiện hành; IdentityGuard gắn principal. IdentityModule phải export guard hoặc composition provider cần thiết cho ba module mới.
- `UsersService.byId/isActive/grants`: dữ liệu users-owned; thêm `assertFeaturePermission(tx,principal,permission)` rechecks session/account/blocked permissions cùng tx. Không dùng foundation AUTHORIZATION_READER trước khi có binding thật.
- `TransactionRunner.run(work)` và `IdempotencyService.execute(input,work)`: tx Serializable/conflict retries, business callback chỉ DB. Idempotency hydrate/replay không bỏ current auth.
- `AuditWriter.append(tx,input)` từ AuditModule; verification actions đã có catalog. Identity AuditService có signature khác; không interchange. Catalog create/update/archive thêm audited action projection chỉ allowed fields; reason bắt buộc cho archive/revoke/reject.
- `OutboxWriter.append(tx,event)`; payload≤4096 serialized chars, no file URL/key/token. Register publisher/consumer đúng type trước enqueue.
- `FileStorageService.upload`/`issueDownload(input,policy)`; scan/storage providers đã có. Status/attach chưa public, phải bổ sung owner API.

## New owner contracts

| Owner          | Planned API                                                                                                                           | Guarantee                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| skills         | assertActive(tx,skillId), readCatalog(query)                                                                                          | lock catalog trong mutations, status current; read DTO không Prisma entity                                               |
| sharing-skills | assertOwnedActive(tx,userId,id), recomputeVerification(tx,id), readPublicSkills(userId,query), countVerified(tx,userId)               | owns sharing mutation/badge; locked aggregate, visibility filter                                                         |
| users          | assertFeaturePermission(tx,principal,code), setVerifiedSkillCount(tx,userId,count)                                                    | live session/grants recheck, user lock, users table writes only here                                                     |
| storage        | getOwnedUploadStatus(actor,fileId,purpose), attachReady(tx,{actor,fileId,resource,generation?}), assertBoundReady(tx,fileId,resource) | owner/purpose/state/generation/hash checked; server snapshot returned; durable binding under lock                        |
| verifications  | assertEvidenceRead(actor,fileId,resource), decisions/submit use cases                                                                 | evidence→submission→SharingSkill linkage, owner/reviewer current permission; private read policy passed to issueDownload |

Storage attachment API must be exported from StorageModule through owner service, not its repository. Evidence snapshots copied server-side during attach; no callback uploads/provider reads in transaction. File READY status eligibility from persisted scan; object existence is checked by download/storage adapter outside business transaction.

Verified counter ownership: sharing service computes after user lock, users service writes same tx. Avoid circular Nest modules: composition root/provider factory binds public projection/counter ports; users ProfileReader injects a `PublicSharingSkillsReader` port bound by feature composition, không import repository/sharing module ngược vòng.

## Events and recovery

`skill.verification.decided`, version1, payload `{verificationId,sharingSkillId,ownerId,status}`; revoke event `skill.evidence.revoked`, version1, `{evidenceId,sharingSkillId,ownerId}`. correlationId server request context; eventId/dedupe persisted cùng decision. Notification handler rehydrates safe decision summary từ verifications contract, ghi notification tối thiểu một lần theo eventId, không lưu file URL.

Publisher/consumer registration, durable notification row/dedupe và retry/dead-letter là scope implementation slice7; không tự coi identity SMTP worker reuse được. Mọi notification write/read/recovery contract do notifications sở hữu. Full inbox/read-mark/email preferences tách feature; owner verification history là synchronous source of truth.

## Future handoff (no writes now)

- proposals consumes `assertTeacherEligible(tx,{userId,skillId,verifiedRequired})` từ sharing-skills: active account/catalog, SharingSkill chưa archive, VERIFIED nếu Request đòi. Không tự ban UNVERIFIED vì chưa có policy.
- learning-path completion provides authoritative completed agreement/plan/learner/skill facts; learned-skill recorder idempotent `(userId,skillId,sourcePlanId)` không đổi SharingSkill badge hoặc gán skill cho teacher ONE_WAY.
- Direct invitation/anti-spam và taxonomy aliases chưa ở scope; không tạo giả endpoint có return success khi nghiệp vụ chưa tồn tại.
