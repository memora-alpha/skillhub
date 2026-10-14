# HTTP Contract — Kỹ năng (planned)

> 2026-10-14: [Level catalog contract](../skill-level-catalog.md) adds public/Admin
> level routes and Sharing Skill `levelId` input. Sharing Skill response `level` is
> now an open catalog code, with `levelId` and `skillLevel`. Learning Request offered
> skill cards inherit these additions; Learning Request currentLevel stays unchanged.

Base `/api/v1`. JWT Bearer qua IdentityGuard/live session cho protected routes. Envelope hiện hành `success:true,message,data,meta?`; errors `success:false,message,statusCode`. Paginated `meta.pagination={nextCursor,hasMore,limit}`; limit1–50/default20; opaque cursor gắn filter/order, invalid cursor400. UTC ISO Z; UUID IDs; experienceYears JSON decimal string hoặc null, max1 decimal; fileSizeBytes JSON integer string.

Unknown DTO fields rejected; không nhận userId/reviewerId/verificationStatus/storageKey/scanStatus từ client. String validation theo Unicode code points sau trim; optional empty title/description cho phép trong giới hạn. All decisions/save dùng server clock.

## Routes

| Method/path                                                              | Access                               | Input / result                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| GET /skills                                                              | Public                               | q2–100?,categoryId?,cursor?,limit?; ACTIVE catalog items                                                              |
| GET /skills/{skillId}                                                    | Public                               | ACTIVE detail; inactive historical display thông qua own records/profile, không browse public catalog                 |
| GET /skills/{skillId}/sharers                                            | User ACTIVE                          | verifiedOnly?,cursor?,limit?; visible/nonarchived/ACTIVE accounts and catalog; minimal public user+sharing projection |
| GET /me/skills                                                           | Owner                                | includeArchived boolean defaultfalse; cursor/limit; private owner projection                                          |
| POST /me/skills                                                          | sharing-skill:create:self            | skillId,level,description,experienceYears?,isVisible?;201 created                                                     |
| PATCH /me/skills/{sharingSkillId}                                        | sharing-skill:update:self+owner      | level?,description?,experienceYears?,isVisible?,expectedVersion;200 updated, no skillId                               |
| POST /me/skills/{sharingSkillId}/archive                                 | sharing-skill:archive:self+owner     | expectedVersion;200 archived; PENDING→409                                                                             |
| POST /me/skills/{sharingSkillId}/restore                                 | sharing-skill:restore:self+owner     | expectedVersion;200 original record restored; catalog must be ACTIVE; duplicate unarchived skill→409                  |
| POST /me/skills/{sharingSkillId}/evidence-files                          | skill-verification:submit:self+owner | multipart one file; validate linked skill before upload;202 {fileId,state:QUARANTINED}                                |
| GET /me/skills/{sharingSkillId}/evidence-files/{fileId}                  | Owner                                | upload/scan status only, no objectKey; file must owned and purpose EVIDENCE                                           |
| POST /me/skills/{sharingSkillId}/verifications                           | skill-verification:submit:self+owner | fileIds1–5 distinct,title?,description?;201 pending request                                                           |
| GET /me/skills/{sharingSkillId}/verifications                            | Owner                                | history with batch/file status,reasons/reviewer/time; cursor/limit                                                    |
| GET /me/skills/{sharingSkillId}/verifications/{verificationId}           | Owner                                | request detail; immutable files and decisions                                                                         |
| GET /me/skills/{sharingSkillId}/evidence/{evidenceId}/download           | Owner                                | 200 {url,expiresAt}; READY file only                                                                                  |
| GET /staff/verifications                                                 | skill-verification:read              | status filter defaultPENDING,cursor/limit; safe queue summary                                                         |
| GET /staff/verifications/{verificationId}                                | skill-verification:read              | skill/request/history/file metadata; no raw storageKey                                                                |
| GET /staff/verifications/{verificationId}/evidence/{evidenceId}/download | skill-verification:read              | fresh authorization, correct linkage;200 short signed URL                                                             |
| POST /staff/verifications/{verificationId}/approve                       | skill-verification:approve           | expectedVersion,note?≤500;200 approved batch                                                                          |
| POST /staff/verifications/{verificationId}/reject                        | skill-verification:reject            | expectedVersion,rejectReason10–500;200 rejected batch                                                                 |
| POST /staff/verifications/{verificationId}/evidence/{evidenceId}/revoke  | skill-verification:revoke            | reason10–500;200 revoked file; idempotency protects repeated writes                                                   |
| GET /admin/skills                                                        | catalog management permission        | status/q/cursor/limit; includes inactive/archived for authorized operators                                            |
| POST /admin/skills                                                       | skill-catalog:create                 | name,slug?,categoryId?,description?,status;201 created                                                                |
| PATCH /admin/skills/{skillId}                                            | skill-catalog:update                 | name?,slug?,categoryId?,description?,status ACTIVE/INACTIVE?,expectedVersion;200 updated                              |
| POST /admin/skills/{skillId}/archive                                     | skill-catalog:archive                | expectedVersion,reason;200 archived, no DELETE                                                                        |
| POST /admin/skills/{skillId}/restore                                     | skill-catalog:restore                | expectedVersion,reason,status ACTIVE/INACTIVE (required);200 restored; non-ARCHIVED→409                               |

`GET /api/v1/profiles/{userId}` hiện có được bổ sung `sharingSkills` chỉ visible/chưa archive, badge và verifiedSkillCount; lịch sử catalog INACTIVE có thể hiển thị label/status trong profile nhưng không xuất hiện search. Không trả evidence/reasons/private fields. Profile page không bị cắt ngầm danh sách: thêm cursor endpoint `GET /profiles/{userId}/skills` public theo cùng rules khi số lượng vượt embedded preview20.

## Inputs and projections

Sharing Skill: level BEGINNER/INTERMEDIATE/ADVANCED/EXPERT; description20–1500; experienceYears decimal string0–60/max1 digit; isVisible defaulttrue. expectedVersion integer≥1; stale409. Skill name2–100; description0–500; slug lowercase ASCII URL-safe2–120 (technical contract), no leading/trailing hyphen; supplied slug collision409. Category nếu supplied phải tồn tại; không tạo taxonomy từ request này.

Owner projection: id,skill{id,name,slug,status},level,description,experienceYears,isVisible,archivedAt,verificationStatus,latestVerification,version. Public subset: id,skill,level,description,experienceYears,verificationStatus; no latestVerification/reasons/archive/private files. Search User projection dùng existing public name/bio/avatar/reputation fields, no email.

Submission title/description áp dụng cho file mới trong batch; download requires evidence relation, file ownership/binding và live reviewer permission. Approved không đồng nghĩa scanner READY vĩnh viễn: non-READY/failure unavailable download.

## Permission matrix and seeds

| Permission                                       | USER default   | STAFF default       | ADMIN default  |
| ------------------------------------------------ | -------------- | ------------------- | -------------- |
| sharing-skill:create/update/archive/restore:self | Yes (own only) | Yes (own only)      | Yes (own only) |
| skill-verification:submit:self                   | Yes (own only) | Yes (own only)      | Yes (own only) |
| skill-verification:read/approve/reject           | No             | Yes                 | Yes            |
| skill-verification:revoke                        | No             | Explicit grant only | Yes            |
| skill-catalog:create/update/archive/restore      | No             | Explicit grant only | Yes            |

Admin list cần một trong catalog create/update/archive/restore; không bypass permission chỉ vì route `/admin`. Seeds merge missing grants, không overwrite assignments/restrictions. Existing update/verification permission codes giữ nguyên; add create/archive/restore/submit/catalog codes đồng bộ type catalog. Recheck current grants trong mutation tx và trước idempotent replay.

Restore là command riêng, không cho PATCH bỏ qua archive. Catalog giữ nguyên ID/name/slug/references; restore không tự khôi phục các Sharing Skill đã archive. Sharing Skill giữ level/description/experienceYears/isVisible và badge hiện tại, kể cả bằng đã revoke trong lúc archive; archivedAt về null, version tăng một, verifiedSkillCount được recompute cùng transaction. Lịch sử/evidence không bị sao chép hoặc reset. Audit catalog yêu cầu reason; Sharing Skill ghi lý do hệ thống cho thao tác owner. Xem [restore amendment](../restore.md).

## Idempotency and errors

`Idempotency-Key` required for JSON mutating POST/PATCH (create/submit/archive/restore/decision/catalog changes); upload stream không replay key vì bytes không trong fingerprint, retries tạo fileId mới và orphan cleanup. Key user+operation scoped; normalized payload fingerprint; same key/body replay minimal reference then hydrate current DTO, khác body409. Retry không nhân đôi audit/event; auth current phải pass cả replay.

400 invalid/unknown input;401 invalid/revoked session;403 missing permission;404 wrong owner/resource/file binding hoặc hidden profile;409 duplicate active/pending/name/slug,stale version,terminal decision,file not READY hoặc pending archive. Restore conflicts: SKILL_NOT_ARCHIVED, SHARING_SKILL_NOT_ARCHIVED, SKILL_NOT_ACTIVE, SKILL_DUPLICATE, STALE_VERSION. 413 bytes>10.000.000;415 MIME/format;429 throttle hiện có;503 storage/scan/policy unavailable. All use error envelope hiện hành, không expose raw provider exception.

Signed URL TTL từ `storage.downloadTtlSeconds` (default120,max300 hiện có); permission được check mỗi lần cấp. Link đã cấp có hiệu lực đến TTL dù quyền bị thu hồi sau đó; feature không hứa thu hồi immediate S3 URL.
