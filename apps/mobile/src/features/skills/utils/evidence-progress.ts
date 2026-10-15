import type { EvidenceDraft } from "./evidence-draft";

export function evidenceProgress(files: EvidenceDraft[], slowScan = false) {
  const uploaded = files.filter((file) => !!file.fileId).length;
  if (!uploaded && !files.some((file) => file.state === "UPLOADING"))
    return "Đang chuẩn bị bằng chứng…";
  if (uploaded < files.length)
    return `Đang tải bằng chứng (${uploaded}/${files.length})…`;
  const ready = files.filter((file) => file.state === "READY").length;
  if (ready < files.length && slowScan)
    return "Đã tải lên · Kiểm tra lâu hơn dự kiến…";
  if (ready < files.length)
    return `Đang kiểm tra bằng chứng (${ready}/${files.length})…`;
  return "Đang gửi yêu cầu xác minh…";
}
