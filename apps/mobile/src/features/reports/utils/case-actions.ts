export function canWriteCase(status: string | undefined, blocked = false) {
  return (
    !blocked &&
    !!status &&
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(status)
  );
}
