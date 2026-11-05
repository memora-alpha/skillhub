import { conversationReference } from "../api/conversation-context";

export function requestGroupTitle(
  id: string,
  state: {
    title?: string;
    denied?: boolean;
    pending?: boolean;
    skillName?: string;
    inlineReference?: boolean;
  },
) {
  const title = !state.denied ? state.title?.trim() : undefined;
  if (title) return title;
  const reference = conversationReference(id);
  if (state.inlineReference === false) {
    if (state.pending && !state.denied) return "Đang tải tên bài…";
    return state.skillName?.trim() || "Chưa đọc được tên bài";
  }
  if (state.pending && !state.denied) return `Đang tải ${reference}`;
  const skill = state.skillName?.trim();
  return skill ? `${skill} · ${reference}` : `Yêu cầu ${reference}`;
}
