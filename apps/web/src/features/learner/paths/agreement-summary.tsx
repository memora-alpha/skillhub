"use client";
import { useUserSession } from "../auth/session";
import { ProfileName } from "../components/profile-name";
import type { LearningPath } from "../types";
import styles from "./agreement-summary.module.css";
export function AgreementSummary({
  exchangeType,
  teacherId,
  learnerId,
  amount,
  locked = false,
  counterpartId,
}: Readonly<{
  exchangeType: string;
  teacherId?: string | null;
  learnerId?: string | null;
  amount?: string | null;
  locked?: boolean;
  counterpartId?: string;
}>) {
  const { actor } = useUserSession();
  let roleLabel = "Học một chiều";
  if (learnerId === actor.userId) roleLabel = "Bạn học";
  if (teacherId === actor.userId) roleLabel = "Bạn hướng dẫn";
  if (exchangeType === "TWO_WAY") roleLabel = "Trao đổi hai chiều";
  const who = (id?: string | null) => {
    if (id === actor.userId) return "Bạn";
    if (id) return <ProfileName id={id} />;
    return "Chưa xác định";
  };
  return (
    <section className={styles.summary} aria-label="Thỏa thuận">
      <div className={styles.line}>
        <strong>
          {roleLabel}
          {" · "}
          {amount
            ? new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 2,
              }).format(Number(amount)) + " CR"
            : "Chưa chốt Credit"}
          {exchangeType === "TWO_WAY" && amount ? "/người" : ""}
        </strong>
        {!locked && <span className="muted">Dự thảo</span>}
      </div>
      <details>
        <summary>Chi tiết thỏa thuận</summary>
        {exchangeType === "ONE_WAY" ? (
          <>
            <p>Người học, bên trả: {who(learnerId)}</p>
            <p>Người hướng dẫn, bên nhận: {who(teacherId)}</p>
            <p>
              Cho toàn lộ trình. Người hướng dẫn nhận 96% khi quyết toán; phí
              4%.
            </p>
          </>
        ) : (
          <>
            <p>Bạn và {who(counterpartId)} cùng học và hướng dẫn nhau.</p>
            <p>Mỗi người nhận lại 96% Credit đã giữ khi quyết toán; phí 4%.</p>
          </>
        )}
        {!locked && <p>Credit chỉ được giữ khi chốt lịch thành công.</p>}
      </details>
    </section>
  );
}
export function PathAgreementSummary({
  path,
}: Readonly<{ path: LearningPath }>) {
  const { actor } = useUserSession();
  return (
    <AgreementSummary
      exchangeType={path.agreement.exchangeType}
      teacherId={path.agreement.teacherId}
      learnerId={path.agreement.learnerId}
      amount={
        path.agreement.negotiatedCredit ?? path.agreement.totalCreditPerUser
      }
      locked={path.lockedVersion !== null}
      counterpartId={
        path.participantAId === actor.userId
          ? path.participantBId
          : path.participantAId
      }
    />
  );
}
