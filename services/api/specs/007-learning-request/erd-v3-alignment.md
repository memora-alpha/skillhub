# Learning Request alignment with ERD v3

Date: 2026-10-07. Scope: Learning Request attributes/storage, its Request relationships, HTTP projections and persistence. This is not a conformance claim for all downstream modules.

## Authoritative sources

- [ERD supplied by the user](https://app.diagrams.net/#G1JiIJ1wo_df8xEz5MohOCPp3htqKFvA-A#%7B%22pageId%22%3A%22skillhub-logical-v3%22%7D), page `skillhub-logical-v3`. Original [local snapshot](../../../../docs/SkillHub_Logical_Data_Model_v3.drawio): 121095 bytes, SHA-256 `70569641d3903ad275b157b94ea33d252542ddef24ffc62d3f4c60f243a936b9`.
- [SRS supplied for the Tag decision](https://docs.google.com/document/d/17vqfPIvEelaAhHR7qt0bh1i2DrSUk8b0/edit): V1.6, `SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`. Original [local snapshot](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx): 147542 bytes, SHA-256 `ca0c048f403984aa46a211e0092bf351dbf640f734d83f75ed20cdb19936c7be`.
- The user requested fixes to match this ERD and decided to retain Tag only if the supplied SRS requires it. No source file was edited.

## Tag requirement

V1.6 explicitly includes Tag for Learning Request:

- Section 18.10: optional `tags` of type string[]/UUID[], at most 10 valid tags, used for search/filter.
- FR-LR-01: create with skill/tag; FR-LR-07: browse/search/filter by skill/tag; FR-LR-08: recommendations by Sharing Skill/Tag.
- BR-07 and section 9.2 also include skill/tag in Learning Request data.

The v3 diagram does not draw a Tag entity or Request–Tag relation. Preserve the existing canonical Catalog `Tag` and composite `RequestTag(requestId, tagId)` relationship to meet the SRS and the user's conditional instruction. These remain a documented extension to the diagram; arbitrary tag labels and a second taxonomy are not introduced.

## Attribute mapping after the fix

Prisma and SQL use the v3 column names. Existing camelCase application/API aliases remain stable. `version` still increments on every mutation and guards optimistic concurrency; it maps to the diagram's `content_version` column.

| ERD attribute         | Prisma/application field        | Physical storage                                               |
| --------------------- | ------------------------------- | -------------------------------------------------------------- |
| request_id            | id                              | UUID primary key                                               |
| owner_id              | ownerId                         | required UUID FK to deployed User primary key                  |
| skill_id              | skillId                         | required UUID FK to Skill                                      |
| title                 | title                           | required VARCHAR(120)                                          |
| description           | description                     | required VARCHAR(3000)                                         |
| learning_goal         | learningGoal                    | required VARCHAR(1000)                                         |
| preferred_slots       | preferredSlots                  | required JSONB, default [], at most five ranges                |
| current_level         | currentLevel                    | nullable LearningLevel enum                                    |
| verified_teacher_only | verifiedTeacherOnly             | required BOOLEAN, default false                                |
| content_version       | version                         | required positive INTEGER, default 1                           |
| moderation_status     | moderationStatus                | required RequestModerationStatus enum                          |
| flagged_rules         | flaggedCategories               | nullable JSONB array of internal category identifiers          |
| reject_reason         | moderationRejectReason          | nullable VARCHAR(500), required 10–500 characters on rejection |
| reviewed_by_user_id   | moderatedByUserId / moderatedBy | nullable UUID FK to User                                       |
| reviewed_at           | moderatedAt                     | nullable UTC TIMESTAMPTZ(3)                                    |
| expires_at            | expiresAt                       | nullable UTC TIMESTAMPTZ(3)                                    |
| status                | status                          | required LearningRequestStatus enum                            |
| created_at            | createdAt                       | required UTC TIMESTAMPTZ(3)                                    |
| updated_at            | updatedAt                       | required UTC TIMESTAMPTZ(3)                                    |

Five existing implementation metadata columns remain: `moderation_rule_set_version`, `moderation_reviewed_version`, `requested_expires_at`, `expiry_mode`, `published_at`. They support the approved moderation snapshot/version, custom/default expiry, and skill immutability rules. They are physical extensions beyond the logical diagram, not additional client-controlled states.

## Behavior and relationship changes

- Preferred slots are stored directly as JSONB on LearningRequest. Remove `RequestPreferredSlot` from the full/scoped schemas and the unapplied feature migration. Persistence serializes ISO timestamps and restores UTC Date values. Validation still limits to five future intervals at mutation, with end > start; stored malformed intervals fail closed. SQL checks array type and maximum length. There is no automatic Schedule/Session creation.
- Add optional boolean `verifiedTeacherOnly` to create/edit; omitted create input defaults false. Strings, numbers and null are rejected. The preference is persisted, versioned and returned in owner/public/reviewer projections and Swagger. `lockForProposal` includes it so Proposal/Verification owners can enforce the requested skill's verification policy; those real consumers remain an integration gate. No verified badge is inferred from the preference.
- Store flagged category identifiers in nullable JSONB `flagged_rules`, retaining minimal internal category information allowed by SRS 18.31. Do not store or expose the full moderation rule set or matched private text. Null storage projects to an empty category list internally; public/owner projections keep categories private.
- User→Request and Skill→Request remain one-to-many with required owner/skill FKs. Request→Proposal and Request→Conversation remain one-to-many; their request FK/relation becomes optional in the full schema, matching v3's direct-search connection flow. Their own migrations and source/participant consistency checks belong to their owners and are not deployed by this feature.
- API routes and `expectedVersion`/`version`/`moderationRejectReason` response naming remain compatible. The new boolean is additive. The physical SQL column changes are not a data conversion for an already deployed database.

## Verification and deployment limits

Test-first evidence: the updated focused tests failed in 11 cases before the production changes, specifically for missing preference handling, old slot storage, old column mappings and required downstream Request relations. The feature's complete unit runner passed 90/90 after the implementation, including a fresh Nest build. Final lint, formatting, typecheck and schema results are recorded in [validation.md](validation.md).

`prisma migrate diff --from-empty --to-schema prisma/identity.prisma --script` produced the expected mapped JSONB/BOOLEAN/version/reviewer columns and FKs, with no `request_preferred_slots` table. This generates SQL only and does not execute it. The feature migration was revised before application; no application database migration, commit or push was performed. `TEST_DATABASE_URL` is unset, so real PostgreSQL integration and rollout remain pending. An environment that has already applied a different version of this migration needs a separate preserving-data conversion rather than replacement of applied migration history.

The focused generated OpenAPI test also failed before the DTO preference annotations were added: this project has no Swagger CLI plugin, so class-validator metadata alone did not expose the input field. Explicit optional-boolean annotations now document create/edit correctly; the generated preference and response schemas are verified without a server or database.
