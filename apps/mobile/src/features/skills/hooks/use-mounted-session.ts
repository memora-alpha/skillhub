import { useEffect, useRef } from "react";
import { useSkills } from "../context/SkillsProvider";

// Pending cleanup may run after blur, but never after unmount/account change.
export function useMountedSession() {
  const mounted = useRef(false);
  const { isCurrent } = useSkills();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return () => mounted.current && isCurrent();
}
