export function createMutationIntent(createKey: () => string) {
  let current: { fingerprint: string; key: string } | undefined;
  return {
    key(operation: string, body: unknown) {
      const fingerprint = JSON.stringify([operation, body]);
      if (!current || current.fingerprint !== fingerprint)
        current = { fingerprint, key: createKey() };
      return current.key;
    },
    clear() {
      current = undefined;
    },
  };
}
