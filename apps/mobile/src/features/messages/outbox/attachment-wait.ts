// A server event can wake a pending GET loop without trusting its payload as state.
export class AttachmentWait {
  private dirty = false;
  private wake?: () => void;
  notify() {
    this.dirty = true;
    this.wake?.();
  }
  wait = (ms: number, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) return Promise.reject(new Error("cancelled"));
    if (this.dirty) {
      this.dirty = false;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        this.wake = undefined;
        this.dirty = false;
      };
      const done = () => {
        finish();
        resolve();
      };
      const abort = () => {
        finish();
        reject(new Error("cancelled"));
      };
      const timer = setTimeout(done, ms);
      this.wake = done;
      signal.addEventListener("abort", abort, { once: true });
    });
  };
}
