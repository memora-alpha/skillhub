import type { UploadedFile } from "@/lib/http/file-upload";

export class ReportFileCheckError extends Error {}
type CheckOptions = {
  signal: AbortSignal;
  active: () => boolean;
  read: (
    id: string,
    signal: AbortSignal,
  ) => Promise<{ fileId: string; state: string }>;
  update: (file: UploadedFile) => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(
        new ReportFileCheckError(
          "Đã dừng kiểm tra tệp. Bấm gửi lại để tiếp tục.",
        ),
      );
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(
        new ReportFileCheckError(
          "Đã dừng kiểm tra tệp. Bấm gửi lại để tiếp tục.",
        ),
      );
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export async function checkReportFiles(
  files: readonly UploadedFile[],
  options: CheckOptions,
) {
  let failure: { cause: unknown } | undefined;
  const check = () => {
    if (failure) throw failure.cause;
    if (options.signal.aborted || !options.active())
      throw new ReportFileCheckError(
        "Đã dừng kiểm tra tệp. Bấm gửi lại để tiếp tục.",
      );
  };
  const ready: UploadedFile[] = new Array(files.length);
  let next = 0;
  async function worker() {
    while (next < files.length) {
      let file = files[next]!;
      const index = next++;
      for (let attempt = 0; attempt < 48; attempt++) {
        check();
        const result = await options.read(file.fileId, options.signal);
        check();
        if (result.fileId !== file.fileId)
          throw new ReportFileCheckError(
            "Chưa xác nhận được tệp đã chọn. Vui lòng gửi lại.",
          );
        file = { ...file, state: result.state };
        options.update(file);
        if (file.state === "READY") {
          ready[index] = file;
          break;
        }
        if (!["UPLOADING", "QUARANTINED", "SCANNING"].includes(file.state))
          throw new ReportFileCheckError(
            `Tệp “${file.name}” chưa thể sử dụng. Bỏ tệp này rồi chọn lại.`,
          );
        if (attempt === 47)
          throw new ReportFileCheckError(
            "Tệp vẫn đang được kiểm tra. Vui lòng gửi lại sau; không cần chọn lại tệp.",
          );
        await (options.sleep ?? pause)(
          attempt < 23 ? Math.min(500 * 2 ** attempt, 3000) : 5000,
          options.signal,
        );
      }
    }
  }
  check();
  // Two readers at most; drain in-flight work before returning a failure.
  await Promise.allSettled(
    Array.from({ length: Math.min(2, files.length) }, async () => {
      try {
        await worker();
      } catch (cause) {
        failure ??= { cause };
      }
    }),
  );
  if (failure) throw failure.cause;
  check();
  return ready;
}
