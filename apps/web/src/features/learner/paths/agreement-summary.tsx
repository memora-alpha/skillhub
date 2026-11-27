"use client";
import { useUserSession } from "../auth/session";
import { ProfileName } from "../components/profile-name";
import type { LearningPath } from "../types";
import styles from "./agreement-summary.module.css";
import { feeRatePresentation } from "./fee-rate-presentation";
export function AgreementSummary({
  exchangeType,
  teacherId,
  learnerId,
  amount,
  locked = false,
  feeRateSnapshot,
  counterpartId,
}: Readonly<{
  exchangeType: string;
  teacherId?: string | null;
  learnerId?: string | null;
  amount?: string | null;
  locked?: boolean;
  feeRateSnapshot?: string | null;
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
  const fee = feeTerms(feeRateSnapshot);
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
            <p>Cho toàn lộ trình. {fee.oneWay}</p>
          </>
        ) : (
          <>
            <p>Bạn và {who(counterpartId)} cùng học và hướng dẫn nhau.</p>
            <p>{fee.twoWay}</p>
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
      feeRateSnapshot={path.agreement.feeRateSnapshot}
      counterpartId={
        path.participantAId === actor.userId
          ? path.participantBId
          : path.participantAId
      }
    />
  );
}

function feeTerms(rate: string | null | undefined) {
  const presentation = feeRatePresentation(rate);
  if (!presentation)
    return {
      oneWay:
        "Mức người hướng dẫn nhận và phí nền tảng sẽ được chốt khi khóa lịch.",
      twoWay: "Mức hoàn Credit và phí nền tảng sẽ được chốt khi khóa lịch.",
    };
  return {
    oneWay: `Người hướng dẫn nhận ${presentation.returned} khi quyết toán; phí ${presentation.fee}.`,
    twoWay: `Mỗi người nhận lại ${presentation.returned} Credit đã giữ khi quyết toán; phí ${presentation.fee}.`,
  };
}
