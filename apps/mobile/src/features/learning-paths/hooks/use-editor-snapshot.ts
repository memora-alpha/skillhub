import { useRef, useState } from "react";

// Only an explicit reload adopts a server revision and resets the local form.
export function useEditorSnapshot<T>(revision: string, value: T) {
  const baseline = useRef({ revision, value });
  const latest = useRef({ revision, value });
  latest.current = { revision, value };
  const [, render] = useState(0);
  const captured = baseline.current;
  return {
    value: captured.value,
    changed: captured.revision !== revision,
    isCurrent: () =>
      captured === baseline.current &&
      captured.revision === latest.current.revision,
    reload: () => {
      baseline.current = latest.current;
      render((previous) => previous + 1);
      return baseline.current.value;
    },
  };
}
