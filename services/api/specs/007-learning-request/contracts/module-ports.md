# Learning Request application contracts

Các contracts LR đã được export trong source; concrete upstream adapters và downstream consumers vẫn là integration gates. `TransactionContext` và `Principal` tái sử dụng từ foundation/Identity. Các exported port không tự mở transaction. Composition root cung cấp adapter; dependency thiếu trả lỗi dịch vụ, không cấp quyền mặc định. [ERD v3 alignment](../erd-v3-alignment.md) ghi các thay đổi storage và preference mới.

Baseline downstream được phân tích trong [SRS V1.5 / change report](../srs-v1.5-changes.md); cập nhật LR theo ERD v3 và Tag của V1.6 ở alignment report. exchangeType, teacher/learner và negotiatedCredit được chọn/chốt trong Chat/thỏa thuận; LearningPath là agreement tổng, LearningPlan là lộ trình của learner. Không đưa các field này vào DTO LR hoặc sửa signatures chỉ để sao chép dữ liệu downstream.

## Shared feature types

Định nghĩa tại `src/modules/learning-requests/application/contracts/learning-request.types.ts`:

```ts
type RequestVersion = number; // safe positive integer

type LearningRequestPublicOwner = {
  id: string;
  displayName: string;
  avatarUrl: string | null; // current selected CLEAN avatar, signed for 60s
};
type SlotInput = { startAt: string; endAt: string }; // absolute RFC3339
type LearningRequestInput = {
  title: string;
  skillId: string;
  description: string;
  learningGoal: string;
  currentLevel?: "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  verifiedTeacherOnly?: boolean; // ERD v3; default false on create
  tagIds?: string[]; // canonical Catalog IDs; max 10, confirmed by SRS V1.6
  preferredSlots?: SlotInput[];
  expiresAt?: string | null; // null/omit -> 30d from publish; custom max 90d
};
type LearningRequestPatch = Partial<LearningRequestInput> & {
  expectedVersion: RequestVersion;
};
type VersionCommand = { expectedVersion: RequestVersion };
type ModerationCommand = VersionCommand & { reason: string };
type RequestQuery = {
  skillId?: string;
  tagIds?: string[];
  keyword?: string;
  status?: LearningRequestStatus;
  limit?: number;
  cursor?: string;
};
type RequestListScope = "FEED" | "MINE" | "MODERATION" | "RECOMMENDED";
type SummaryByScope = {
  FEED: RequestSummary;
  MINE: OwnerRequestSummary;
  MODERATION: ModerationRequestSummary;
  RECOMMENDED: RequestSummary;
};
type RequestPage<T = RequestSummary> = {
  items: T[];
  nextCursor: string | null;
};
```

`LearningRequestStatus`, `ModerationStatus`, các Summary/Detail types định nghĩa theo [data model](../data-model.md) và [HTTP projections](http.md); không expose Prisma User hoặc raw DB object. DTO tags nhận `tagIds`, là cách chuẩn hóa tên `tags` của SRS; Catalog owner vẫn cần cung cấp adapter kiểm tra IDs/status.

## Access and use cases

File `application/services/learning-request-access.service.ts`:

```ts
interface LearningRequestAccessService {
  assertAction(
    tx: TransactionContext,
    principal: Principal,
    permission: string,
  ): Promise<Principal>;
}
```

Gọi SessionsService.assertLive trong tx, kiểm tra explicit permission; create/publish thêm role USER và new-activity eligibility. Resource owner/status kiểm tra sau load/lock trong use case. List kiểm tra live principal mỗi request và áp dụng scope ở query. Dùng IdentityGuard ở HTTP; không trộn request.principal với generic authenticatedIdentity chưa được wire.

Use cases trong `application/use-cases/`, mỗi class có `execute`:

| Class                          | Signature                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| CreateLearningRequestUseCase   | `(actor: Principal, input: LearningRequestInput): Promise<OwnerRequestDetail>`                                                       |
| EditLearningRequestUseCase     | `(actor: Principal, requestId: string, input: LearningRequestPatch): Promise<OwnerRequestDetail>`                                    |
| PublishLearningRequestUseCase  | `(actor: Principal, requestId: string, input: VersionCommand): Promise<OwnerRequestDetail>`                                          |
| ModerateLearningRequestUseCase | `(actor: Principal, requestId: string, decision: "APPROVE" \| "REJECT", input: ModerationCommand): Promise<ModerationRequestDetail>` |
| CancelLearningRequestUseCase   | `(actor: Principal, requestId: string, input: VersionCommand): Promise<OwnerRequestDetail>`                                          |
| ExpireLearningRequestsUseCase  | `(batchSize: number): Promise<{processed: number}>`                                                                                  |
| ListLearningRequestsUseCase    | `<S extends RequestListScope>(actor: Principal, scope: S, query: RequestQuery): Promise<RequestPage<SummaryByScope[S]>>`             |
| GetLearningRequestUseCase      | `(actor: Principal, requestId: string): Promise<RequestDetail \| OwnerRequestDetail \| ModerationRequestDetail>`                     |

`ModerateLearningRequestUseCase` lấy request/correlation context từ framework hiện có, không nhận actor/context từ body. Page type xác định theo scope; không dùng cùng raw-object serializer cho feed/owner/reviewer.

## Dependency ports

File `application/ports/learning-request-dependencies.ts`:

```ts
interface SkillCatalogReader {
  assertActiveSelection(
    tx: TransactionContext,
    selection: {
      skillId: string;
      tagIds: readonly string[];
    },
  ): Promise<{ skillId: string; tags: { id: string; label: string }[] }>;
  readSelections(
    tx: TransactionContext,
    selection: {
      skillIds: readonly string[];
      tagIds: readonly string[];
    },
  ): Promise<{
    skills: { id: string; name: string }[];
    tags: { id: string; label: string }[];
  }>;
}
interface RequestOwnerReader {
  readPublicOwners(
    tx: TransactionContext,
    userIds: readonly string[],
  ): Promise<LearningRequestPublicOwner[]>;
}
interface SharingSkillReader {
  getMatchingSnapshot(
    tx: TransactionContext,
    userId: string,
  ): Promise<{
    skillIds: readonly string[];
    tagIds: readonly string[];
    version: string;
  }>;
}
interface RequestLockReader {
  assertNotLocked(tx: TransactionContext, requestId: string): Promise<void>;
}
interface NewActivityEligibilityReader {
  assertAllowed(
    tx: TransactionContext,
    userId: string,
    action: "CREATE_LEARNING_REQUEST" | "PUBLISH_LEARNING_REQUEST",
  ): Promise<void>;
}
```

Catalog validates canonical IDs/status trong cùng tx; không query table khác từ LR guard. Sharing snapshot phục vụ ranking/cursor, không áp điều kiện “phải VERIFIED” mới. New-activity reader do Users/Reputation owner cung cấp, không tự biến reputation thấp thành LOCKED. Các adapter chưa có: gate merge contract, test double chỉ trong test, runtime không bind adapter cho phép tất cả.

BR-41/OTP-008: email OTP cooldown không đồng nghĩa account LOCKED. Eligibility reader không chặn create/publish chỉ vì cooldown nếu account ACTIVE/session/grants hợp lệ và không có restriction khác; Identity sở hữu OTP policy. Không kiểm tra wallet/20 Credit khi tạo/publish Request.

Catalog readSelections cho phép projection lịch sử của Skill đã inactive mà không cấp phép tạo/publish mới. RequestOwnerReader do Users cung cấp, chỉ id/displayName; repository LR không serialize User hoặc đọc private profile trực tiếp. Batch IDs phải lấy từ Request đã được scope-filter, không nhận danh sách User tùy ý từ client.

## LR lifecycle owner contract for other modules

File `application/services/learning-request-lifecycle.service.ts`:

```ts
interface LearningRequestLifecycleService {
  lockForProposal(
    tx: TransactionContext,
    requestId: string,
    proposerId: string,
  ): Promise<{
    requestId: string;
    ownerId: string;
    skillId: string;
    verifiedTeacherOnly: boolean;
    version: number;
  }>;
  beginNegotiation(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void>;
  markMatched(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void>;
  markClosed(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void>;
}
```

- `lockForProposal` lock row, kiểm tra OPEN còn hạn và owner != proposer; trả `verifiedTeacherOnly` cùng `skillId`. Proposal/Verification consumer phải kiểm tra Sharing Skill tương ứng đã VERIFIED khi preference là true (SRS V1.6 PP-001). Proposal module chịu trách nhiệm actor eligibility/Proposal state; LR contract không tự tạo Proposal hoặc tự cấp verification. Concrete consumers chưa có trong checkout.
- Accept gọi lockForProposal rồi beginNegotiation trong cùng tx với Proposal ACCEPTED và Conversation create/reuse. Cancel/expire cạnh tranh phải serialize với row đó. Chỉ một OPEN -> NEGOTIATING thắng; không Hold/Session.
- markMatched chỉ được gọi bởi Path/Schedule application lock flow đã final-validate, không HTTP route/client. TWO_WAY có đúng hai LearningPlan A→B/B→A do teacher tương ứng tạo, ONE_WAY đúng một teacher→learner; mọi learner confirm current plan version, A/B confirm current agreement version và lịch, account/conflict/required-wallet checks đều hợp lệ. Owner thực hiện Hold theo exchangeType rồi lock/tạo Session và Request MATCHED trong cùng tx; lỗi rollback hết. LR không tự đọc plan/ledger hay tính Credit.
- markClosed chỉ từ completion flow của agreement liên kết Request: mọi Session của tất cả LearningPlan đã COMPLETED, không còn dispute giữ Credit và settlement theo exchangeType thành công. Agreement completion/ledger và Request CLOSED cùng tx; không đóng khi chỉ một plan TWO_WAY hoàn tất. Đây là precondition owner flow phải enforce; LR không tự thêm engine settlement.
- RequestLockReader do Path/Schedule owner cung cấp, kiểm tra thỏa thuận liên kết Request cho cả TWO_WAY/ONE_WAY trong cùng tx sau Request row lock. Một learner confirm hoặc agreement CONFIRMED không tự được coi là Schedule LOCKED; owner cancel vẫn được trước Schedule LOCKED theo policy đã duyệt. Thiếu adapter trong NEGOTIATING không suy ra unlocked. Thứ tự sorted User locks -> Request -> agreement/plan/schedule và các owner locks thống nhất trước consumer integration.

Các precondition trên thuộc caller owner use case, cần real integration evidence trước claim hoàn tất; internal DI contract không phải authorization thay cho HTTP. Request `expectedVersion` chỉ bảo vệ Request; learnerConfirmedVersion/plan.version và agreement.version do Path owner kiểm tra, không dùng thay nhau. Sửa plan làm tăng plan version/reset confirmations liên quan theo V1.5, không tự đổi Request về OPEN hoặc cho cancel sau LOCK. Amendment sau LOCK nằm ở downstream.

TWO_WAY giữ min 20/User/thỏa thuận và settlement 96%/4% của chính mỗi User. ONE_WAY chỉ learner Hold negotiatedCredit >0 tối đa hai chữ số thập phân, teacher không phải Hold; V1.6 18.40 chốt feeRate snapshot 4% và teacher nhận 96%, không áp minimum 20 của TWO_WAY. V1.5 OP-13 fee note là lịch sử; refund/cancel/no-show vẫn cần policy của owner. Owner Wallet phải thống nhất biểu diễn số tiền với constitution integer Credit/VND trước implement (SRS cho decimal hoặc integer sub-credit; không dùng float). LR không lưu/tính Credit nên không đổi constitution/schema tiền trong feature này; các consumer phải đối chiếu toàn bộ V1.6 trước integration.

Skill/goal Request là nhu cầu ban đầu, không ghi đè skill/goal của hai LearningPlan; TWO_WAY có thể trao đổi hai skill khác nhau. Completion cập nhật kỹ năng cho đúng learner do downstream owner thực hiện, ONE_WAY không tự thêm kỹ năng cho teacher. Contract/version/policy hiện là proposed integration, Path/Schedule/Wallet chưa có runtime trong checkout.

## Rejection event and notification consumer

File `application/contracts/learning-request-rejection.event.ts`:

```ts
type LearningRequestRejectionPayload = {
  requestId: string;
  ownerId: string;
  reviewedVersion: number;
  decisionVersion: number;
  rejectReason: string; // sanitized snapshot 10–500, owner-readable
};
// OutboxMessage: eventId UUID, type "learning-request.rejected",
// version 1, correlationId UUID, payload as above.
```

Generate eventId một lần ngoài TransactionRunner retry callback. Audit/outbox chỉ append sau state/version check. HTTP retry với stale expectedVersion -> 409, không tạo quyết định thứ hai.

Notifications-owned `LearningRequestRejectionPublisher.publish(event: OutboxMessage): Promise<void>` validate type/version/payload trước processOnce, consumer name `learning-request-rejection-in-app-v1`. Trong tx, repository insert Notification id=eventId/userId=ownerId, type LEARNING_REQUEST_REJECTED/channel IN_APP, body từ snapshot reason và payload chứa request/version. Không fetch rejectReason hiện tại của Request để dựng event lịch sử. Insert/receipt fail cùng rollback; publish throw để dispatcher retry.

Notification reader/mark-read dùng live Principal và recipient scope. OP-05 channel production còn mở; email/push adapters không nằm trong feature này. Những exported contracts trên là điều kiện integration của SH-040/042/055, không tuyên bố các consumer đã triển khai.
