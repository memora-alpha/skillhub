export type ChatUpload = {
  id: string;
  filename: string;
  size: number;
  state: string;
};
export const chatExtensions =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.ppt,.pptx,.txt";
export function validateChatFiles(
  files: { name: string; size: number }[],
  existing: { size: number }[] = [],
) {
  if (files.length + existing.length > 5)
    throw new Error("Mỗi tin nhắn có tối đa 5 tệp.");
  if (files.some((file) => file.size <= 0 || file.size > 15_000_000))
    throw new Error(
      "Mỗi tệp phải có dữ liệu và không quá 15 MB (15.000.000 byte).",
    );
  if (
    files.reduce((sum, file) => sum + file.size, 0) +
      existing.reduce((sum, file) => sum + file.size, 0) >
    50_000_000
  )
    throw new Error("Tổng dung lượng một tin nhắn không quá 50 MB.");
  if (
    files.some(
      (file) =>
        !/\.(pdf|docx?|jpe?g|png|webp|xlsx?|pptx?|txt)$/i.test(file.name),
    )
  )
    throw new Error(
      "Chỉ chọn ảnh, PDF, tài liệu Office hoặc tệp TXT được hỗ trợ.",
    );
}
