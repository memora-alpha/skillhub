"use client";
import { useUserSession } from "../auth/session";
import { ProfileName } from "../components/profile-name";
import type { LearningPath } from "../types";
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
  const who = (id?: string | null) => {
    if (id === actor.userId)
      return <strong>Bạn ({actor.profile.fullName})</strong>;
    if (id) return <ProfileName id={id} />;
    return "Chưa xác định";
  };
  return (
    <section
      className="learner-notice"
      aria-label="Vai trò và Credit trong thỏa thuận"
    >
      <p>
        <strong>
          {locked
            ? "Thỏa thuận đã khóa"
            : "Dự thảo chưa khóa · chưa giữ Credit"}
        </strong>
      </p>
      {exchangeType === "ONE_WAY" ? (
        <>
          <p>
            Người học / bên trả: {who(learnerId)} ·{" "}
            {amount ?? "Chưa thống nhất"} CR cho toàn lộ trình.
          </p>
          <p>
            Người hướng dẫn / bên nhận khi quyết toán: {who(teacherId)}. Nhận
            96% Credit thương lượng; phí nền tảng 4%.
          </p>
        </>
      ) : (
        <>
          <p>
            Hai chiều: bạn ({actor.profile.fullName}) và {who(counterpartId)}{" "}
            mỗi người {locked ? "đã được giữ" : "sẽ được giữ khi chốt"}{" "}
            {amount ?? "chưa thống nhất"} CR.
          </p>
          <p>
            Mỗi người dạy một kế hoạch và học kế hoạch của đối phương. Khi quyết
            toán đủ điều kiện, mỗi người nhận lại 96% khoản mình đã giữ; phí 4%.
          </p>
        </>
      )}
      <p>
        {locked
          ? "Xem các buổi học chính thức trong lịch học và theo dõi quyết toán theo kết quả máy chủ."
          : "Xác nhận điều khoản, kế hoạch và lịch chưa thay thế thao tác chốt cuối. Máy chủ kiểm tra lại và giữ Credit khi chốt thành công."}
      </p>
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
