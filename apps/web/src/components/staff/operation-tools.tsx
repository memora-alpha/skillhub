"use client";
import { useRef, useState } from "react";
import { useStaffSession } from "./session";
import { isSessionFailure } from "@/lib/staff/client";

export function useOperation() {
  const { expire } = useStaffSession();
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, after?: () => unknown) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage("Đã lưu thay đổi.");
      after?.();
    } catch (cause) {
      if (isSessionFailure(cause)) expire();
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể xử lý. Vui lòng thử lại.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    run,
    feedback: (
      <>
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
        {message && <output>{message}</output>}
      </>
    ),
  };
}

export { Identifier } from "./identifier-field";
