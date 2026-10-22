// Navigation follows an explicit user action, never a render/URL/redirect effect.
export function explicitPaymentNavigation(options: {
  current: () => boolean;
  epoch: () => unknown;
  outcome: () => string;
  navigate: () => void;
}) {
  let pending = false;
  return async (work: () => Promise<void>) => {
    if (pending || !options.current()) return;
    pending = true;
    const epoch = options.epoch();
    try {
      await work();
      if (
        options.current() &&
        options.epoch() === epoch &&
        ["known", "unknown"].includes(options.outcome())
      )
        options.navigate();
    } finally {
      pending = false;
    }
  };
}
