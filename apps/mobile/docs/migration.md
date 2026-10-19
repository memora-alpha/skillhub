# Phase00 Chuyển đổi tài liệu và quy trình mobile

## Đính chính phạm vi sau migration

Người dùng xác nhận Wallet/Payment đang được phát triển ở nhánh khác. Quan sát thiếu spec006/integration files trong baseline bên dưới chỉ thuộc checkout migration, không phải lỗi, nợ kỹ thuật hoặc yêu cầu triển khai lại. Nhánh hiện tại không audit/triển khai Wallet/Payment; công việc đó tiếp tục ở nhánh đang làm. Tên nhánh/commit chưa được cung cấp. Work Wallet đã chuyển thành điểm tham chiếu liên nhánh; không giữ các task triển khai giả định trùng với công việc đó.

## Quyết định scope và baseline M01

Người dùng trong prompt migration đã quyết định mobile ngừng Spec Kit; thực hiện chỉ PhầnA, ghi B/C/D/E vào tài liệu/template rồi dừng. Quyết định này không cần ADR chờ duyệt. Source/UI/API behavior/stack đang chạy được giữ nguyên, không scaffold/reset Phase0. Không commit/push/PR/merge/deploy hoặc đổi branch/index.

- Bắt đầu kiểm working tree sạch trên branch docs/mobile-workflow; HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd.
- Mốc baseline hash/index: 2026-10-19T19:46:57+07:00, lấy từ đồng hồ và chuyển múi giờ Việt Nam +07:00. Trước edit không có staged/unstaged/untracked trong git status; local ignored tooling/instructions đã tồn tại, CLAUDE.md chưa có.
- Root/mobile README/AGENTS, docs/SOURCE_OF_TRUTH, sáu docs mobile trực tiếp, constitution1.0.0 ngày2026-10-12 và feature selector được đọc trước chuyển.
- Selector cũ: specs/006-wallet-payment-history. Thực tế checkout chỉ001..005, Wallet source là preview. Không khôi phục nhánh/file hoặc dựng validation006 không tồn tại.
- Toàn bộ tracked files đã có hash/index baseline tạm ngoài repo để so diff; [spec inventory](archive/specs-inventory.md) lưu hash và danh mục lịch sử cần chia sẻ. Không đọc/in .env, tokens hoặc credentials.

## Danh mục khảo sát và giới hạn

| Nguồn                                        | Nội dung đã đối chiếu / giới hạn                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root guidance/README/SOURCE_OF_TRUTH/package | Phạm vi/Git, pnpm10.24.0/engines, SRS1.6; không áp backend constitution vào mobile                                                                                                                                                                   |
| Mobile README/AGENTS + six direct docs       | Setup/UI/source layout, domain/state matrix/API checkpoints/network evidence; tách current khỏi lịch sử                                                                                                                                              |
| Constitution/mobile tooling                  | Sáu principles, governance/state,10 skills Spec Kit và .specify; chỉ đọc, không chạy scripts hoặc nạp workflow cũ                                                                                                                                    |
| Specs001/002                                 | Scope/foundation planned tree, auth journeys/contracts/plan/tasks và evidence/gaps; scaffold/package task cũ chưa tự tick dù source đã có                                                                                                            |
| Specs003/004                                 | Profile public amendment/avatar/privacy; skills task/checklist/gaps và các evidence gần nhất, source API/evidence pipeline/scan/compression. Không xác minh mọi artifact screenshot local hoặc render mọi màn lịch sử                                |
| Specs005                                     | Spec/plan/task gates/resume/contracts/HTTP/checklist/validation gần nhất, FR-35/Tag/weekly/public-profile/mock Proposal. Research/data-model/UI/quickstart/fixture history được giữ/link nguyên tại archive; không tái thực thi mọi kịch bản lịch sử |
| Spec006 và normal-payment-integration        | Không tìm thấy; chỉ selector là dấu vết, ghi thiếu ở Wallet status                                                                                                                                                                                   |
| Mobile source/config công khai               | package/tsconfig/ESLint/checker, HTTP/Query/Auth/token/network/providers/theme; profile/skills/LR adapters/schemas, Wallet và các preview contexts được dẫn trong docs. Không audit toàn bộ app/native/deployment                                    |
| Backend read-only                            | Identity HTTP/controller/DTO/projections; skills level/HTTP sources, LR module/controllers/DTO, Wallet/Payment HTTP/controller/DTO/recovery. Không sửa source/spec/config/migration backend                                                          |
| SRS1.6                                       | Trích đọc OOXML đoạn nghiệp vụ và IDs liên quan account/profile/skills/LR/plan/schedule/session/credit/material; không kiểm layout hay sửa DOCX. Changelog cũ không thay rule settlement hiện hành                                                   |

Không tuyên bố full API deployment, real payment/provider, OS background/process kill hoặc device acceptance từ việc đọc source. Bằng chứng lịch sử có nguồn/ngày/phạm vi ở validation được giữ, không trình bày như vừa chạy lại. Không phát minh danh tính reviewer hoặc lời phê duyệt.

## Mapping nguồn cũ → nơi sở hữu mới M02–M04

| Nguồn cũ                                                  | Đích mới                                                                                                                                                                      | Nội dung giữ lại                                                                       | Lịch sử / loại khỏi quy trình                                                                                   | Chưa xác minh                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Mobile README                                             | [README](../README.md), [contributing](contributing.md)                                                                                                                       | Quick start/setup/commands/assets/license                                              | Bỏ dùng specs làm workflow; source-status chuyển contract/work                                                  | ExpoGo/device thực tế                                                            |
| docs/architecture                                         | [architecture](architecture.md), [guides](README.md)                                                                                                                          | Boundaries/public entries/design target vs checker; provider/theme thực                | Planned src/theme/store/test tree không là cây thực; chi tiết luồng sang contract/source                        | Không audit graph toàn app                                                       |
| docs/domain-rules/state-machines                          | [domain](domain-rules.md), [states](state-machines.md)                                                                                                                        | SRS1.6 rules và phân biệt máy trạng thái thực/mong muốn                                | Không dùng sơ đồ dự kiến làm wire contract/feature evidence                                                     | Policy future domains; SRS/identity mismatches                                   |
| docs/api-contracts checkpoints                            | [contracts](contracts/README.md), [compatibility page](api-contracts.md)                                                                                                      | Auth/profile/skills/LR projections/endpoints/errors và gaps hiện hành                  | [Bản lưu nguyên nội dung](archive/api-contracts-before-migration.md) có nhãn lịch sử; không là contract thứ hai | Old deployed/provider/native assertions không nâng thành pass                    |
| docs/feature-matrix                                       | [matrix](feature-matrix.md), [roadmap](roadmap.md)                                                                                                                            | Module → feature source/contract/work, dependency                                      | Không giữ first implementation order/checkpoint lặp status                                                      | Modules05..10 chưa khảo sát đủ                                                   |
| docs/network-state validation                             | [network](network-state.md), [lịch sử](archive/network-validation-2026-10-10.md)                                                                                              | Behavior/probe/read-only recovery; số tests cũ giữ lịch sử                             | Không lấy121 tests/web2026-10-10 làm current run                                                                | Native airplane/modal/Back/resume                                                |
| Constitution1.0.0 principles1–6                           | [architecture](architecture.md), [workflow](workflow.md), [contributing](contributing.md), guides                                                                             | Scope/source/server authority/privacy/reuse/checks/evidence                            | Governance/Constitution Check/feature selector không tiếp tục áp dụng                                           | Không cần phê duyệt lại quyết định migration                                     |
| Specs001/002 open tasks                                   | [work index](work/README.md), [auth contract](contracts/auth-account.md)                                                                                                      | Provider/storage/integration/mailbox/native và extraction/legacy debt                  | Lịch sử tại chỗ; không tạo lại hồ sơ/ID/checkbox                                                                | Source vs accepted status theo từng task                                         |
| Specs003/004 task/checklist/gaps                          | [profile](contracts/profile.md), [skills](contracts/skills-evidence.md), [work index](work/README.md)                                                                         | Pending Back/iOS/Figma/real CLEAN/scanner/native/privacy/count/sort gaps               | Giữ task/decision/evidence gốc, không tick API/native từ browser/export                                         | Full User API/evidence/scanner/native                                            |
| Spec005 tasks T025..T032, resume/FR-35                    | [LR plan](work/phase-04-learning-request-discovery/plan.md), [status](work/phase-04-learning-request-discovery/status.md), [contract](contracts/learning-requests.md)         | Giữ IDs/conditions/AC, dữ liệu Tag/weekly/offerings và profile/mock boundary           | T021..T024/T036 đã có source; đoạn Tag/weekly503 cũ là lịch sử; specs nguyên tại chỗ                            | T037 chỉ resume nhắc, không definition trong tasks; lock/API/native/CI còn thiếu |
| Selector specs/006; prompt nói normal-payment integration | [Wallet plan](work/phase-03-wallet-topup/plan.md), [status](work/phase-03-wallet-topup/status.md), [contract](contracts/wallet-payments.md)                                   | Contract BE thật, fixture mobile thật, missing provenance, financial acceptance limits | Không phát minh spec006/Txxx hoặc tích hợp native hiện không thấy                                               | Intended revision/hồ sơ006/decisions/UI design/API/provider/native               |
| PromptB/C/D/E                                             | [workflow](workflow.md), [guides](README.md), [roadmap](roadmap.md), [templates](work/_template/plan.md), [status template](work/_template/status.md), [ADR](adr/template.md) | Quy chuẩn tương lai/sub-phase/review/UAT có nguồn/code references                      | Không cài Jest/NativeWind/storage/telemetry hoặc chạy phases sản phẩm                                           | Chưa có automation kiểm toàn bộ quy chuẩn                                        |

Mỗi rule/contract có nơi sở hữu ở trên; index/roadmap chỉ dẫn nguồn, plan giữ task, status giữ evidence. Không chuyển toàn bộ history specs vào docs mới;001..005 giữ nguyên tại chỗ, gồm screenshots/fixtures. [Archive index](archive/README.md) là đường tra lịch sử.

## Khác biệt cần tiếp tục, ngoài scope migration

- Wallet baseline khác mô tả prompt:006 và integration/recovery files thiếu; source chỉ preview. Không suy người dùng đã thay quyết định/payment mode từ một checkpoint không tìm thấy.
- LR source mới đã mở B05/B08 và wired Catalog/owner/SharingSkill; nguồn cũ blanket503/weekly Save disabled lỗi thời. B04 lock vẫn unavailable; deployment readiness khác source.
- Profile another UUID đã API theo amendment2026-10-13, thay fixture-only cũ; title/path-count/bio sanitizer/native acceptance không được tự đóng.
- SRS OTP cooldown429 và đăng ký account pending khác identity neutral400/Redis draft hiện hành. Không sửa rule/contract trong migration. Cần chốt nếu mở rộng behavior.
- Skills cap config/hard ceiling/INACTIVE public/material-change policy/history newest-first còn khác biệt; full User/API/scan/native/EXIF vẫn pending, không dùng Admin catalog acceptance thay.
- Root README mô tả mobile foundation-only đã sửa đúng một dòng thành app Expo có thật. Không sửa root tooling/ignore hoặc backend guidance.

## Lưu và ngừng tooling mobile M05

Đã kiểm tracked/untracked/ignored và reparse trước di chuyển: tooling .specify và10 thư mục .agents/skills/speckit-* đều ignored, không có tracked file/junction/symlink. Không thấy .claude/.codex/integration-agent khác tại mobile; giữ mọi mục không liên quan. Không đi vào node_modules/.expo để di chuyển tooling. Root/backend tooling nguyên vẹn.

Bản local: apps/mobile/.workflow-archive/speckit-20261019T195952+0700/. Có manifest.json và backup/; source paths được giữ tương đối. Copy backup và so SHA256/byte/count trước khi Move-Item nguyên bản ra khỏi discovery; so hash sau move. Tổng 11 directories/31 files, mỗi file có hash/path/tracking trong manifest. Không xóa vĩnh viễn.

| Đường dẫn mobile cũ                  | Đích tương đối trong archive                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| .specify                             | .specify (backup: backup/.specify)                                                         |
| .agents/skills/speckit-analyze       | .agents/skills/speckit-analyze (backup: backup/.agents/skills/speckit-analyze)             |
| .agents/skills/speckit-checklist     | .agents/skills/speckit-checklist (backup: backup/.agents/skills/speckit-checklist)         |
| .agents/skills/speckit-clarify       | .agents/skills/speckit-clarify (backup: backup/.agents/skills/speckit-clarify)             |
| .agents/skills/speckit-constitution  | .agents/skills/speckit-constitution (backup: backup/.agents/skills/speckit-constitution)   |
| .agents/skills/speckit-converge      | .agents/skills/speckit-converge (backup: backup/.agents/skills/speckit-converge)           |
| .agents/skills/speckit-implement     | .agents/skills/speckit-implement (backup: backup/.agents/skills/speckit-implement)         |
| .agents/skills/speckit-plan          | .agents/skills/speckit-plan (backup: backup/.agents/skills/speckit-plan)                   |
| .agents/skills/speckit-specify       | .agents/skills/speckit-specify (backup: backup/.agents/skills/speckit-specify)             |
| .agents/skills/speckit-tasks         | .agents/skills/speckit-tasks (backup: backup/.agents/skills/speckit-tasks)                 |
| .agents/skills/speckit-taskstoissues | .agents/skills/speckit-taskstoissues (backup: backup/.agents/skills/speckit-taskstoissues) |

Mobile .gitignore chỉ append /.workflow-archive/; giữ nguyên các dòng khác. AGENTS.md cập nhật ngắn, CLAUDE.md cùng trỏ docs/workflow; cả hai vẫn ignored, không force-add/đổi policy. Quy trình chia sẻ nằm trong README/docs, không phụ thuộc local files.

### Cách khôi phục khi người dùng yêu cầu

Đây là hướng dẫn khôi phục backup, không phải workflow thường xuyên và không tự thực thi:

1. Đọc manifest.json local ở archive trên. Chọn entry cần khôi phục; xác minh absolute source/target đều thuộc apps/mobile và không có reparse point.
2. Đối chiếu SHA256 từng file với manifest; có cả bản retired tại archive/<original> và bản backup/<original>. Không dùng archive từ checkout khác làm bằng chứng current contract.
3. Chỉ Copy-Item -LiteralPath từ bản đã xác minh về đúng original khi discovery target chưa tồn tại. Nếu đã có target thì dừng phần xung đột, không overwrite/merge mù. Không restore root/backend.
4. Verify hash/count sau copy; giữ bản archive. Agent instructions/workflow chỉ đổi lại khi người dùng yêu cầu, không tự áp chỉ thị constitution cũ.
5. Mở phiên agent mới để kiểm discovery: migration đã kiểm filesystem paths không còn hoạt động, không tuyên bố cache skill trong phiên được xóa.

Bản archive/manifest ignored chỉ tồn tại checkout này, không được chia sẻ qua Git. Người khác cần tooling cũ phải có bản lưu riêng; các yêu cầu/quy chuẩn còn hiệu lực đã được đưa vào docs có version control.

## Kiểm tra và mốc hoàn tất M06

Đã hoàn tất migration tài liệu/tooling. Source/tests/config/dependencies và index/HEAD/branch giữ nguyên theo hash/diff baseline; các phase sản phẩm chưa được chạy. Mốc kiểm tra 2026-10-19T20:05:05+07:00.

| Mốc | Kết quả tài liệu cần có                                        | Nguồn evidence                                              |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| M01 | Baseline/inventory/scope bảo toàn working tree                 | Baseline và spec inventory ở trên                           |
| M02 | Bản đồ docs/current contracts/history tách vai trò             | Mapping và docs index                                       |
| M03 | 9 guides/source references/actual defaults/checker limits      | Architecture và guides                                      |
| M04 | Roadmap/plan/status chuyển tiếp, task IDs và acceptance còn mở | Hai work, work index                                        |
| M05 | Local instructions/shared workflow/tooling retired an toàn     | Manifest/hash/ignore/discovery record ở trên                |
| M06 | Diff đúng phạm vi, link/format/immutability kiểm xong          | Kết quả cuối ngay dưới, không tự coi sản phẩm đã nghiệm thu |

## Kết quả kiểm tra migration

| Kiểm tra                                 | Kết quả và giới hạn                                                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Diff scope và baseline1368 tracked files | PASS:9 tracked files thay đổi đều trong allowlist;39 files specs (kể cả ảnh) không đổi SHA256. Source/tests/assets/config/package/lockfile, backend/web/shared và root agent tooling không đổi. File mới thuộc docs; hai instructions và archive local vẫn ignored |
| Git/index/branch/HEAD                    | PASS: index entries giữ nguyên, branch docs/mobile-workflow và HEAD không đổi; không stage/commit/push/PR/merge/deploy                                                                                                                                             |
| Links mới/current                        | PASS:42 Markdown files (docs + mobile README/AGENTS/CLAUDE),460 local links hợp lệ tại checkout. Không kiểm remote URLs; không dùng ignored artifacts làm evidence chia sẻ                                                                                         |
| Lịch sử specs                            | Trước retirement không phát hiện missing local-link target trong các specs đã scan. Sau retirement có1 reference constitution trong spec005/plan.md không còn resolve tại đường dẫn cũ; giữ file bất biến, mapping dưới đây. Không claim đây là link hỏng có sẵn   |
| Active workflow scan                     | PASS: không có chỉ thị thực thi Spec Kit trong docs/instructions hiện hành. Migration/archive nhắc tooling để mapping/lịch sử; specs bất biến không là instruction active                                                                                          |
| Tooling archive                          | PASS:31 originals +31 backup files có SHA256 đúng manifest,11 source discovery directories đã vắng; không reparse, không di chuyển skill ngoài danh mục. Không kiểm cache discovery trong phiên; mở phiên mới nếu cần                                              |
| Format                                   | PASS qua Prettier có sẵn,40 files hiện hành/instructions;2 snapshots lịch sử giữ format cũ. Root README chỉ sửa mobile row, không format toàn root                                                                                                                 |
| Whitespace                               | PASS: git diff --check; file mới cũng qua formatter/check newline                                                                                                                                                                                                  |
| Runtime/API/native/provider tests        | NOT_RUN có chủ đích: task chỉ docs/tooling, không app test/build/export, không mutation/giao dịch thật                                                                                                                                                             |

Lệnh pnpm exec prettier ban đầu bị pnpm tự gọi dependency install và abort vì NO_TTY trước purge; không chấp thuận/cài lại dependencies. Đã dùng trực tiếp node node_modules/prettier/bin/prettier.cjs --ignore-path .gitignore để format/check đúng40 files; package/config/lockfiles vẫn khớp baseline.

Historical reference không resolve sau migration: specs/005-learning-request/plan.md → ../../.specify/memory/constitution.md. Nguồn đã được lưu tại apps/mobile/.workflow-archive/speckit-20261019T195952+0700/.specify/memory/constitution.md (và backup tương ứng), hash theo manifest. Quy chuẩn hữu ích thuộc architecture/workflow/guides, không tạo .specify stub để giữ discovery sống và không sửa specs lịch sử.

## Bước tiếp theo

Dừng sau migration. Wallet/Payment tiếp tục ở nhánh khác theo xác nhận người dùng; chỉ đối chiếu source/docs/contracts của nhánh đó khi được giao review hoặc tích hợp. Rà code tại checkout hiện tại tập trung Auth/session/network, Learning Request và Profile/Skills; Learning Request có thể nghiệm thu phần API/native độc lập theo plan. Features khác đọc index/contract thay vì regenerate specs. Không tự bắt đầu coding, cài stack hoặc thao tác backend/provider.

## Nhật ký đính chính 2026-10-19T20:19:15+07:00

Nguồn: người dùng trong chat xác nhận “wallet và payment đang ở nhánh khác đang làm”. Đã cập nhật contract, architecture, matrix, roadmap và work index; Wallet plan/status chỉ còn ranh giới phối hợp, không là backlog của checkout này. Giữ quan sát baseline/lịch sử migration để truy vết, nhưng không dùng chúng kết luận tình trạng nhánh khác. Không đọc/chuyển nhánh, merge hoặc sửa source.

## Rà cuối trước commit 2026-10-19T20:41:24+07:00

Người dùng yêu cầu “rà lại đi sau đó commit”, cho phép chốt docs/tooling và báo cáo source audit trên nhánh docs/mobile-workflow. Các ghi nhận không stage/commit ở trên mô tả thời điểm migration trước yêu cầu này.

- Đối chiếu lại baseline 1368 tracked files: chỉ 9 file docs/README/mobile ignore đã đổi; 36 file mới đều thuộc docs. Source/tests/assets/config/package/lockfile và backend/web/shared giữ nguyên; 39 file specs lịch sử khớp SHA256. Index còn nguyên trước khi stage.
- Kiểm 44 Markdown files, gồm README/AGENTS/CLAUDE mobile: 476 liên kết local hợp lệ. Không kiểm remote URLs. Bản archive tooling và backup khớp 62 hashes; 11 discovery directories vẫn vắng.
- Prettier đạt cho docs hiện hành/instructions; hai snapshots lịch sử giữ nội dung gốc. Root README chỉ thay nội dung hàng mobile; formatter căn lại khoảng trắng của bảng repository theo hook hiện có. git diff --check đạt.
- Chạy lại source reproduction: F01/F02 vẫn tái hiện, chưa sửa runtime. Kết quả 296 tests và lint/type/structure thuộc lượt source audit, không chạy lại toàn suite cho thay đổi docs này. Chi tiết tại [báo cáo audit](work/source-audit/status.md).
- Kiểm quy tắc commit: 6/6 tests đạt. pnpm mặc định tự yêu cầu install do allowBuilds khác metadata local và dừng NO_TTY; dùng pnpm_config_verify_deps_before_run=warn trong tiến trình kiểm tra/commit để chạy scripts bằng dependencies sẵn có. Không cài lại hoặc sửa config/dependencies; vẫn chạy lint-staged và commitlint qua hooks.

Hai findings P2 để nhánh fix riêng. Wallet/Payment tiếp tục ở nhánh đang làm; commit này không bao gồm triển khai hoặc nghiệm thu sản phẩm, push/PR/merge/deploy.
