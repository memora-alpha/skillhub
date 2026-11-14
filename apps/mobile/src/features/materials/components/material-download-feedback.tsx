import { InfoModal } from "@/components/InfoModal";
import { FormNotice } from "@/components/FormNotice";
import type { useMaterialDownload } from "../hooks/use-material-download";
import { materialFailure } from "../utils/material-failure";

export function MaterialDownloadFeedback({
  download,
}: Readonly<{ download: ReturnType<typeof useMaterialDownload> }>) {
  return (
    <>
      {!!download.error && (
        <FormNotice tone="error" compact>
          {materialFailure(download.error)}
        </FormNotice>
      )}
      {download.complete && (
        <FormNotice tone="success" compact>
          Đã gửi tệp đến nơi lưu bạn chọn.
        </FormNotice>
      )}
      {download.awaitingConfirmation && (
        <InfoModal
          title="Tải tài liệu đã mua?"
          onClose={download.cancel}
          confirmLabel="Xác nhận tải"
          onConfirm={() => void download.confirm()}
        >
          Khi cấp đường dẫn tải, hệ thống ghi nhận tài liệu đã được sử dụng. Đơn
          mua sẽ không còn đủ điều kiện hoàn tiền tự động, kể cả khi việc tải
          tệp không thành công.
        </InfoModal>
      )}
    </>
  );
}
