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
export function ModerationScreen() {
  const { api } = useStaffSession();
  const [q, setQ] = useState("");
  const queue = useStaffList<LearningRequest>("learning-requests?limit=20");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<LearningRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const selected =
    queue.items.find((item) => item.id === selectedId) ??
    (receipt?.id === selectedId ? receipt : null);
  const visible = queue.items.filter((item) =>
    `${item.title} ${item.description} ${item.id}`
      .toLocaleLowerCase("vi")
      .includes(q.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeader
        title="Yêu cầu học chờ duyệt"
        desc="Xem nội dung bị gắn cờ, kiểm tra nhu cầu học và lý do trước khi duyệt."
        actions={
          <button
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
                        {item.flaggedCategories.join(" · ") ||
                          "Chờ nhân viên xem xét"}
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
                desc="Nội dung và nhóm gắn cờ sẽ hiển thị ở đây."
              />
            </Card>
          ) : (
            <Card title={selected.title}>
              <div className="stack">
                <div className="row">
                  <StatusBadge status={selected.status} />
                  <Badge>Phiên bản {selected.version}</Badge>
                </div>
                {receipt?.id === selected.id && (
                  <p className="staff-success" role="status">
                    Máy chủ đã ghi nhận quyết định.
                  </p>
                )}
                {selected.flaggedCategories.length > 0 && (
                  <div className="staff-flag">
                    <strong>Nhóm bị gắn cờ</strong>
                    <div className="row">
                      {selected.flaggedCategories.map((category) => (
                        <Badge key={category} tone="warn">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
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
                        {skill.skill.name} · {skill.level}
                      </Badge>
                    ))}
                  </div>
                )}
                <dl className="kv staff-kv">
                  <dt>Người đăng</dt>
                  <dd className="mono">{selected.ownerId}</dd>
                  <dt>Mã kỹ năng muốn học</dt>
                  <dd className="mono">{selected.skillId}</dd>
                  <dt>Trình độ hiện tại</dt>
                  <dd>{selected.currentLevel ?? "Chưa cung cấp"}</dd>
                  <dt>Người dạy đã xác minh</dt>
                  <dd>
                    {selected.verifiedTeacherOnly
                      ? "Bắt buộc"
                      : "Không bắt buộc"}
                  </dd>
                  <dt>Credit mong muốn / giờ</dt>
                  <dd>
                    {selected.desiredCreditPerHour
                      ? `${selected.desiredCreditPerHour} CR`
                      : "Chưa cung cấp"}
                  </dd>
                  {selected.moderationRejectReason && (
                    <>
                      <dt>Lý do từ chối</dt>
                      <dd>{selected.moderationRejectReason}</dd>
                    </>
                  )}
                </dl>
                {selected.preferredAvailability && (
                  <section>
                    <h3 className="sub-title">
                      Thời gian rảnh · {selected.preferredAvailability.timeZone}
                    </h3>
                    <ul className="staff-slots">
                      {selected.preferredAvailability.weeklySlots.map(
                        (slot) => (
                          <li key={`${slot.weekday}:${slot.startTime}`}>
                            {weekdays[slot.weekday] ?? slot.weekday}:{" "}
                            {slot.startTime}–{slot.endTime}
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                )}
                {!selected.preferredAvailability &&
                  !!selected.preferredSlots?.length && (
                    <section>
                      <h3 className="sub-title">Thời gian mong muốn</h3>
                      {selected.preferredSlots.map((slot) => (
                        <p key={slot.startAt}>
                          {fmtDateTime(slot.startAt)} —{" "}
                          {fmtDateTime(slot.endAt)}
                        </p>
                      ))}
                    </section>
                  )}
                {selected.status === "PENDING_MODERATION" && (
                  <div className="staff-detail-actions">
                    <button
                      className="btn btn-danger"
                      disabled={!!decision || queue.loading}
                      onClick={() => setDecision("reject")}
                    >
                      Từ chối
                    </button>
                    <button
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
                    description={selected.title}
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
