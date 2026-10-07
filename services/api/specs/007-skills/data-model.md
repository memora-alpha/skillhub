# Phase 1 Data Model — Kỹ năng

Models hiện có trong `prisma/schema.prisma`; bổ sung ở runtime generator/additive migration. Không sửa migration v3 cũ hoặc regenerate toàn docs model. Catalog field changes chỉ đồng bộ khi thay đổi business field có chủ đích.

## Entities and ownership

| Entity/owner                    | Existing fields                                                                                                 | Planned additions/invariants                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Skill/skills                    | id,name,slug,categoryId?,description?,status                                                                    | nameKey unique,createdAt/updatedAt,version≥1; name2–100,description≤500                                        |
| SkillCategory/skills            | id,name,slug,status,parentCategoryId?                                                                           | Reference/read-only, không taxonomy CRUD                                                                       |
| SharingSkill/sharing-skills     | userId,skillId,level,description,years?,verificationStatus,visible,archivedAt?                                  | timestamps/version; unique chưa archive; skillId immutable; description20–1500/years0–60 decimal(3,1)          |
| SkillVerification/verifications | sharingSkillId,status,reviewer/time,note?,rejectReason?,submittedAt                                             | version; one PENDING;1–5 Evidence; reviewer/time required cho decision                                         |
| SkillEvidence/verifications     | verificationId+sharingSkillId,title/description,MIME,key,size,checksum,scanStatus,approval/review/revoke fields | storedFileId unique FK; server metadata; size≤10.000.000; title≤120/description≤500; revoke reason/time/actor  |
| StoredFile/storage              | generation,state,purpose,uploader,object/hash metadata                                                          | Durable resource attachment/attachedAt; owner API attach READY exact generation/hash; cleanup ignores attached |
| User/users                      | verifiedSkillCount                                                                                              | Derived VERIFIED chưa archive; users-owned update cùng tx; visibility không giảm count                         |
| UserLearnedSkill/future         | user/skill/sourcePath/sourcePlan/completedAt/ruleVersion                                                        | No writes here; completion producer xác nhận facts                                                             |

Metadata PostgreSQL authoritative; bytes S3 private. Evidence MIME/size/hash là snapshot audit; scan eligibility phải đọc storage-owned contract. Không tự đổi vocabulary scanStatus catalog sang StoredFile state.

## Constraints and upgrade

- SQL unique `(user_id,skill_id) WHERE archived_at IS NULL`; unique verification sharingSkillId WHERE status=PENDING; FK storedFile RESTRICT/unique; giữ composite submission FK hiện có.
- NameKey/version/timestamps backfill deterministic; collision name hoặc duplicate active/pending fail preflight với IDs, không tự merge/archive/delete.
- Existing Evidence thiếu StoredFile link phải map tin cậy từ server; nếu không có thì blocker. Staged nullable chỉ dùng upgrade, không cho approve/download thiếu link; release gate tất cả usable evidence có binding.
- Check description/level/years; rejectReason10–500; approval/revoke required fields. Submission1–5 files được kiểm soát tx service và DB write boundary được test.
- Index search `(skillId,isVisible,verificationStatus)` predicate chưa archive; catalog nameKey/id; queue status/submittedAt/id; owner history sharingSkillId/submittedAt/id.
- Generator rerun giữ additions; migrations fresh/upgrade không reset identity/config/grants/history.

## State transitions

- Catalog ACTIVE↔INACTIVE, ACTIVE/INACTIVE→ARCHIVED terminal trong API.
- SharingSkill chưa archive→archive; nếu PENDING trả409. Visible độc lập. Archive giữ references/approval/history.
- Request PENDING→APPROVED/REJECTED, terminal immutable; submit mới record mới.
- Evidence PENDING→APPROVED/REJECTED theo batch, APPROVED→REVOKED có audit. Revoke không đổi request APPROVED cũ. Không replace bytes hoặc expiry cùng ID.

Badge reducer dưới SharingSkill lock: còn APPROVED chưa revoke→VERIFIED; nếu không, pending request→PENDING; nếu không, quyết định cuối reject/revoke→REJECTED; chưa submission→UNVERIFIED. Owner reason từ history, không public.

## Atomic workflows and recovery

Decision tx: current auth/grants, request/evidence CAS, badge, users count, audit, outbox, idempotency result. Count recompute toàn VERIFIED chưa archive sau lock user; outbox retry không ghi lại decision. Public/search joins current visible+ACTIVE; profile gọi sharing reader qua owner contract.

Internal reconciliation báo counter mismatch và users-owned recompute; không sửa approvals để khớp counter. Storage attach-vs-cleanup cùng lock/CAS, external delete sau CLEANUP_PENDING; không attach state đó. READY orphan grace24h; attached REJECTED/REVOKED cũng giữ để audit; retention/delete policy nếu cần là feature riêng.
