"use client";
import { useUserSession } from "../auth/session";
import { ProductIcon } from "../components/product-icon";
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
  inline = false,
  feeRateSnapshot,
  counterpartId,
}: Readonly<{
  exchangeType: string;
  teacherId?: string | null;
  learnerId?: string | null;
  amount?: string | null;
  locked?: boolean;
  inline?: boolean;
  feeRateSnapshot?: string | null;
  counterpartId?: string;
}>) {
  const { actor } = useUserSession();
  let roleLabel = "Học một chiều";
  if (learnerId === actor.userId) roleLabel = "Bạn học · Một chiều";
  if (teacherId === actor.userId) roleLabel = "Bạn hướng dẫn · Một chiều";
  if (exchangeType === "TWO_WAY") roleLabel = "Trao đổi kỹ năng hai chiều";

  const who = (id?: string | null) => {
    if (id === actor.userId) return "Bạn";
    if (id) return <ProfileName id={id} />;
    return "Chưa xác định";
  };

  const formattedCredit = amount
    ? `${new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 2,
      }).format(
        Number(amount),
      )} CR${exchangeType === "TWO_WAY" ? " / người" : ""}`
    : "Chưa chốt Credit";

  const fee = feeTerms(feeRateSnapshot);

  return (
    <section
      className={styles.summary + (inline ? ` ${styles.summaryInline}` : "")}
      aria-label="Thỏa thuận"
    >
      <div className={styles.line}>
        <span className={styles.roleText}>{roleLabel}</span>
        <span className={styles.creditChip}>
          <ProductIcon name="wallet" size={14} />
          {formattedCredit}
        </span>
        {locked ? (
          <span className={styles.lockedBadge}>
            <ProductIcon name="check" size={12} />
            Đã khóa điều khoản
          </span>
        ) : (
          <span className={styles.draftBadge}>Dự thảo</span>
        )}
      </div>
      <details>
        <summary>Chi tiết điều khoản &amp; phí</summary>
        {exchangeType === "ONE_WAY" ? (
          <>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span>Người học (bên giữ Credit)</span>
                <strong>{who(learnerId)}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Người hướng dẫn (bên nhận)</span>
                <strong>{who(teacherId)}</strong>
              </div>
            </div>
            <p className={styles.detailNote}>
              Áp dụng cho toàn lộ trình. {fee.oneWay}
            </p>
          </>
        ) : (
          <>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span>Hai bên cùng tham gia</span>
                <strong>Bạn &amp; {who(counterpartId)}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Hình thức trao đổi</span>
                <strong>Mỗi bên học và hướng dẫn 1 kế hoạch</strong>
              </div>
            </div>
            <p className={styles.detailNote}>{fee.twoWay}</p>
          </>
        )}
        {!locked && (
          <p className={styles.detailNote}>
            Credit chỉ được tạm giữ khi hai bên hoàn tất bước chốt lịch thành
            công.
          </p>
        )}
      </details>
    </section>
  );
}

export function PathAgreementSummary({
  path,
  inline = false,
}: Readonly<{ path: LearningPath; inline?: boolean }>) {
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
      inline={inline}
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
    oneWay: `Người hướng dẫn nhận ${presentation.returned} khi quyết toán; phí nền tảng ${presentation.fee}.`,
    twoWay: `Mỗi người nhận lại ${presentation.returned} Credit đã giữ khi quyết toán; phí nền tảng ${presentation.fee}.`,
  };
}
