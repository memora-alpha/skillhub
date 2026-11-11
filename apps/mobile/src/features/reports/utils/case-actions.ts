export function canWriteCase(status: string | undefined, blocked = false) {
  return (
    !blocked &&
    !!status &&
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(status)
  );
}
export function canSendCaseMessage(
  status: string | undefined,
  handlerId: string | null | undefined,
  blocked = false,
) {
  return canWriteCase(status, blocked) && handlerId !== null;
}
