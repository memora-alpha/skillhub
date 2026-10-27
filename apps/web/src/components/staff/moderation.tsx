"use client";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { LearningRequest } from "@/lib/staff/types";
import { useStaffSession } from "./session";
import { useStaffList } from "./hooks";
import { DecisionDialog, Pager, QueueState } from "./common";
const weekdays: Record<string, string> = {
  MON: "Thứ hai",
  TUE: "Thứ ba",
  WED: "Thứ tư",
  THU: "Thứ năm",
  FRI: "Thứ sáu",
  SAT: "Thứ bảy",
  SUN: "Chủ nhật",
};
const levels: Record<string, string> = {
  NONE: "Chưa có kinh nghiệm",
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXPERT: "Chuyên gia",
};
function categoryLabel(category: string) {
  return category === "PROPOSED_TAGS"
    ? "Có tag mới cần duyệt"
    : `Khớp nhóm quy tắc: ${category}`;
}
function RequestAvailability({
  request,
}: Readonly<{ request: LearningRequest }>) {
  const availability = request.preferredAvailability;
  if (availability)
    return (
      <section>
        <h3 className="sub-title">Thời gian rảnh · {availability.timeZone}</h3>
        <ul className="staff-slots">
          {availability.weeklySlots.map((slot) => (
            <li key={slot.weekday + ":" + slot.startTime}>
              {weekdays[slot.weekday] ?? slot.weekday}: {slot.startTime}–
              {slot.endTime}
            </li>
          ))}
        </ul>
      </section>
    );
  if (!request.preferredSlots?.length) return null;
  return (
    <section>
      <h3 className="sub-title">Thời gian mong muốn</h3>
      {request.preferredSlots.map((slot) => (
        <p key={slot.startAt}>
          {fmtDateTime(slot.startAt)} — {fmtDateTime(slot.endAt)}
        </p>
      ))}
    </section>
  );
}
function RequestFacts({ request }: Readonly<{ request: LearningRequest }>) {
  return (
    <dl className="kv staff-kv">
      <dt>Trình độ hiện tại</dt>
      <dd>
        {request.currentLevel
          ? (levels[request.currentLevel] ?? request.currentLevel)
          : "Chưa cung cấp"}
      </dd>
      <dt>Người dạy đã xác minh</dt>
      <dd>{request.verifiedTeacherOnly ? "Bắt buộc" : "Không bắt buộc"}</dd>
      <dt>Credit mong muốn / giờ</dt>
      <dd>
        {request.desiredCreditPerHour
          ? `${request.desiredCreditPerHour} CR`
          : "Chưa cung cấp"}
      </dd>
      {request.moderatedAt && (
        <>
          <dt>Thời điểm xử lý</dt>
          <dd>{fmtDateTime(request.moderatedAt)}</dd>
        </>
      )}
      {request.moderationRejectReason && (
        <>
          <dt>Lý do từ chối</dt>
          <dd>{request.moderationRejectReason}</dd>
        </>
      )}
    </dl>
  );
}

function selectedRequest(
  items: readonly LearningRequest[],
  selectedId: string | null,
  receipt: LearningRequest | null,
) {
  return (
    items.find((item) => item.id === selectedId) ??
    (receipt?.id === selectedId ? receipt : null)
  );
}

function decisionDescription(
  request: LearningRequest,
  decision: "approve" | "reject",
) {
  const proposedTags = request.proposedTags ?? [];
  if (decision === "approve" && proposedTags.length > 0)
    return `${request.title}. Yêu cầu sẽ được công khai; các tag ${proposedTags.join(", ")} cũng được duyệt vào danh mục và gắn vào bài.`;
  return request.title;
}

export function ModerationScreen() {
  const { api } = useStaffSession();
  const [q, setQ] = useState("");
  const queue = useStaffList<LearningRequest>("learning-requests?limit=20");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<LearningRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const selected = selectedRequest(queue.items, selectedId, receipt);
  const proposedTags = selected?.proposedTags ?? [];
  const visible = queue.items.filter((item) =>
    `${item.title} ${item.description} ${item.id} ${(item.proposedTags ?? []).join(" ")}`
      .toLocaleLowerCase("vi")
      .includes(q.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeader
        title="Kiểm duyệt yêu cầu học"
        desc="Yêu cầu có tag mới hoặc khớp bộ lọc sẽ chờ duyệt trước khi được công khai."
        actions={
          <button
            type="button"
            className="btn"
            disabled={queue.loading}
            onClick={() => {
              setReceipt(null);
              void queue.reload();
            }}
          >
            Làm mới
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          label="Tìm trong các yêu cầu đã tải"
          placeholder="Tìm trong các mục đã tải…"
        />
        <span className="muted">{queue.items.length} mục đã tải</span>
      </div>
      <div className="split" data-selected={selected !== null}>
        <Card className="split-list" flush>
          <QueueState
            loading={queue.loading}
            error={queue.error}
            empty={!queue.items.length}
            reload={queue.reload}
          >
            {!visible.length ? (
              <Empty
                title="Không có kết quả"
                desc="Thử từ khóa khác hoặc tải thêm yêu cầu."
              />
            ) : (
              <ul className="q-list">
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="q-item"
                      aria-current={item.id === selectedId}
                      onClick={() => {
                        setSelectedId(item.id);
                        setReceipt(null);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span className="q-meta">
                        <StatusBadge status={item.status} />
                        {fmtDateTime(item.createdAt)}
                      </span>
                      <span className="q-meta">
                        {item.flaggedCategories
                          .map(categoryLabel)
                          .join(" · ") || "Chờ nhân viên xem xét"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </QueueState>
          <Pager
            loading={queue.loading}
            hasMore={queue.page?.hasMore}
            more={queue.more}
          />
        </Card>
        <div className="split-detail">
          {!selected ? (
            <Card>
              <Empty
                title="Chọn một yêu cầu học"
                desc="Xem nội dung, tag đề xuất và lý do cần duyệt trước khi quyết định."
              />
            </Card>
          ) : (
            <Card
              title={selected.title}
              actions={
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setSelectedId(null);
                    setReceipt(null);
                  }}
                >
                  Về danh sách
                </button>
              }
            >
              <div className="stack">
                <div className="row">
                  <StatusBadge status={selected.moderationStatus} />
                  <Badge>Phiên bản {selected.version}</Badge>
                </div>
                {receipt?.id === selected.id && (
                  <output className="staff-success">
                    Máy chủ đã ghi nhận quyết định.
                  </output>
                )}
                {selected.flaggedCategories.length > 0 && (
                  <div className="staff-flag">
                    <strong>Lý do cần xem xét</strong>
                    <div className="row">
                      {selected.flaggedCategories.map((category) => (
                        <Badge key={category} tone="warn">
                          {categoryLabel(category)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {proposedTags.length > 0 && (
                  <section>
                    <h3 className="sub-title">Tag đề xuất trong yêu cầu</h3>
                    <div className="row staff-request-tags">
                      {proposedTags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                    {selected.status === "PENDING_MODERATION" && (
                      <p className="muted">
                        Duyệt yêu cầu sẽ duyệt luôn các tag này vào danh mục
                        chung và gắn vào bài. Không cần duyệt lại ở mục Đề xuất
                        tag.
                      </p>
                    )}
                  </section>
                )}
                <section>
                  <h3 className="sub-title">Nội dung yêu cầu</h3>
                  <p className="prose">{selected.description}</p>
                </section>
                <section>
                  <h3 className="sub-title">Mục tiêu học</h3>
                  <p className="prose">{selected.learningGoal}</p>
                </section>
                {selected.teachingOverview && (
                  <section>
                    <h3 className="sub-title">Có thể dạy lại</h3>
                    <p className="prose">{selected.teachingOverview}</p>
                  </section>
                )}
                {!!selected.offeredSharingSkills?.length && (
                  <div className="row">
                    {selected.offeredSharingSkills.map((skill) => (
                      <Badge key={skill.id} tone="brand">
                        {skill.skill.name} ·{" "}
                        {levels[skill.level] ?? skill.level}
                      </Badge>
                    ))}
                  </div>
                )}
                <RequestFacts request={selected} />
                <RequestAvailability request={selected} />
                <details>
                  <summary>Thông tin đối chiếu</summary>
                  <dl className="kv staff-kv">
                    <dt>Mã yêu cầu</dt>
                    <dd className="mono">{selected.id}</dd>
                    <dt>Mã người đăng</dt>
                    <dd className="mono">{selected.ownerId}</dd>
                    <dt>Mã kỹ năng muốn học</dt>
                    <dd className="mono">{selected.skillId}</dd>
                    {selected.moderatedByUserId && (
                      <>
                        <dt>Mã người xử lý</dt>
                        <dd className="mono">{selected.moderatedByUserId}</dd>
                      </>
                    )}
                  </dl>
                </details>

                {selected.status === "PENDING_MODERATION" && (
                  <div className="staff-detail-actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={!!decision || queue.loading}
                      onClick={() => setDecision("reject")}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!!decision || queue.loading}
                      onClick={() => setDecision("approve")}
                    >
                      Duyệt yêu cầu
                    </button>
                  </div>
                )}
                {decision && (
                  <DecisionDialog
                    key={`${selected.id}:${decision}`}
                    title={
                      decision === "approve"
                        ? "Duyệt yêu cầu học"
                        : "Từ chối yêu cầu học"
                    }
                    description={decisionDescription(selected, decision)}
                    label={
                      decision === "approve"
                        ? "Lý do duyệt"
                        : "Lý do gửi tới người đăng"
                    }
                    min={decision === "approve" ? 1 : 10}
                    max={decision === "approve" ? 2000 : 500}
                    danger={decision === "reject"}
                    confirmLabel={
                      decision === "approve"
                        ? "Xác nhận duyệt"
                        : "Xác nhận từ chối"
                    }
                    onClose={() => setDecision(null)}
                    onReload={() => {
                      setReceipt(null);
                      void queue.reload();
                    }}
                    onSubmit={async (reason) => {
                      const result = await api<LearningRequest>(
                        `learning-requests/${selected.id}/${decision}`,
                        {
                          method: "POST",
                          body: { expectedVersion: selected.version, reason },
                        },
                      );
                      setReceipt(result.data);
                      setDecision(null);
                      await queue.reload();
                    }}
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
