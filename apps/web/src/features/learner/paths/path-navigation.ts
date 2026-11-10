const stages: Record<string, string> = {
  PREPARING: "Đang chuẩn bị",
  WAITING_START: "Chờ bắt đầu",
  LEARNING: "Đang học",
  LEARNING_FINISHED: "Đã học xong · Chờ quyết toán",
  COMPLETED: "Đã hoàn tất",
  STOPPED: "Đã dừng",
};
export function learningStageLabel(stage: string | null | undefined) {
  return stage ? stages[stage] : undefined;
}
export function pathActionLabel(
  stage: string | null | undefined,
  attentionCount = 0,
) {
  if (attentionCount > 0) return "Xem việc cần xử lý";
  if (stage === "COMPLETED") return "Xem kết quả & đánh giá";
  if (stage === "LEARNING_FINISHED") return "Theo dõi quyết toán";
  if (stage === "STOPPED") return "Xem kết quả dừng lộ trình";
  if (stage === "LEARNING" || stage === "WAITING_START")
    return "Xem buổi học & tiến độ";
  return "Tiếp tục thỏa thuận";
}
