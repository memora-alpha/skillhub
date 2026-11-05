import type { Post, SharingSkill } from "../types";
const activeCatalog = (skill: SharingSkill) =>
  !skill.skill.status || skill.skill.status === "ACTIVE";
export function canOfferSkill(skill: SharingSkill) {
  return activeCatalog(skill) && skill.isVisible && !skill.archivedAt;
}
export function canTeachPost(skill: SharingSkill, post: Post) {
  return (
    activeCatalog(skill) &&
    skill.skill.id === (post.skill?.id ?? post.skillId) &&
    !skill.archivedAt &&
    (!post.verifiedTeacherOnly || skill.verificationStatus === "VERIFIED")
  );
}
export function postActions(post: Post, now = Date.now()) {
  const owner = !post.owner;
  const expired = !!post.expiresAt && Date.parse(post.expiresAt) <= now;
  return {
    owner,
    expired,
    edit:
      owner &&
      !expired &&
      ["DRAFT", "OPEN", "PENDING_MODERATION", "REJECTED"].includes(post.status),
    publish: owner && post.status === "DRAFT",
    cancel:
      owner &&
      [
        "DRAFT",
        "OPEN",
        "PENDING_MODERATION",
        "REJECTED",
        "NEGOTIATING",
      ].includes(post.status),
    propose: !owner && post.status === "OPEN" && !expired,
  };
}
export function postGuidance(status: string) {
  const messages: Record<string, string> = {
    DRAFT:
      "Bài đang là bản nháp. Xem lại thông tin rồi chọn Xuất bản; lưu nháp chưa công khai bài.",
    PENDING_MODERATION:
      "Bài đang chờ duyệt, chưa nhận đề nghị mới. Nếu có tag mới, tag được xem xét cùng bài. Bạn có thể sửa; người duyệt sẽ phải dùng phiên bản mới.",
    REJECTED:
      "Bài chưa được duyệt. Chỉnh sửa theo lý do bên dưới và lưu về bản nháp, sau đó xuất bản lại để hệ thống kiểm tra.",
    EXPIRED:
      "Bài đã hết hạn và không nhận đề nghị mới. Bạn có thể tạo bài mới với thời gian mong muốn còn hiệu lực.",
    CANCELLED: "Bài đã hủy và không nhận đề nghị mới.",
    MATCHED:
      "Bài đã có thỏa thuận khóa. Xem thỏa thuận và lịch học; không hủy qua nút của bài đăng.",
    CLOSED: "Bài đã hoàn tất. Xem lại lịch sử thỏa thuận trong Lộ trình.",
    NEGOTIATING:
      "Bạn đang trao đổi với đối tác. Hủy chỉ thành công khi chưa có commitment khóa; máy chủ sẽ kiểm tra lại.",
  };
  return messages[status];
}
