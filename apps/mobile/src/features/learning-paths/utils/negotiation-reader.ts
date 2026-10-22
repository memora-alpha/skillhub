// Legacy negotiation messages contain no plan/schedule identity and are never confirmations.
export function readNegotiationMessage(text: string) {
  if (
    text.length > 2000 ||
    !text.startsWith("GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN\n")
  )
    return null;
  const lines = text.split("\n");
  const skill = lines
    .find((line) => line.startsWith("Kỹ năng: "))
    ?.slice(9)
    .trim();
  const goal = lines
    .find((line) => line.startsWith("Mục tiêu: "))
    ?.slice(10)
    .trim();
  if (!skill || !goal || !lines.at(-1)?.endsWith("Chưa giữ Credit."))
    return null;
  return { skill, goal };
}
