"use client";
import { LoadingButton } from "@/components/loading-button";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserResource } from "../hooks/use-user-resource";
import { CommandFeedback, Feedback, Status } from "../components/common";
import { SkillPicker } from "../components/skill-picker";
import { UploadControl } from "../components/upload-control";
import type { OwnedMaterial } from "./account-types";
import {
  canEditMaterial,
  materialEditHint,
} from "./material-management-policy";
import { UserApiError } from "../api/client";
import { formText } from "../components/form-data";
import { MaterialCoverControl, useMaterialCover } from "./material-cover";

export function MaterialEditor({
  material,
  close,
  reload,
}: Readonly<{
  material: OwnedMaterial;
  close: () => void;
  reload: () => void;
}>) {
  const { request } = useUserSession(),
    command = useUserCommand();
  const [skillId, setSkillId] = useState(material.skillId);
  const [access, setAccess] = useState(material.accessType);
  const [fileId, setFileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const cover = useMaterialCover();
  const file = useUserResource<{ state: string; moderationStatus?: string }>(
    fileId ? "me/materials/files/" + fileId : null,
    {
      refetchInterval: (data) =>
        data &&
        ["UPLOADING", "QUARANTINED", "SCANNING"].includes(data.state) &&
        !["REVIEW_REQUIRED", "FAILED"].includes(data.moderationStatus ?? "")
          ? 3000
          : false,
    },
  );
  const disabled =
    command.pending || command.uncertain || !canEditMaterial(material);
  if (!canEditMaterial(material))
    return <p className="learner-notice">{materialEditHint(material)}</p>;
  return (
    <form
      className="learner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = {
          expectedListingVersion: material.listingVersion,
          ...(cover.coverFileId !== undefined
            ? { coverFileId: cover.coverFileId }
            : {}),
          skillId,
          title: formText(form, "title").trim(),
          description: formText(form, "description").trim(),
          accessType: access,
          priceCredit: access === "FREE" ? "0" : formText(form, "price"),
          ...(fileId
            ? {
                fileId,
                distributionRightsConfirmed: form.get("rights") === "on",
              }
            : {}),
        };
        const result = await command.run(JSON.stringify(body), async () => {
          const fresh = await request<OwnedMaterial>(
            "me/materials/" + material.id,
          );
          if (
            !canEditMaterial(fresh.data) ||
            fresh.data.listingVersion !== material.listingVersion
          )
            throw new UserApiError(409, "MATERIAL_VERSION_CONFLICT");
          return request("me/materials/" + material.id, {
            method: "PATCH",
            body,
          });
        });
        if (result) {
          reload();
          close();
        }
      }}
    >
      <h3>Sửa tài liệu · phiên bản {material.listingVersion}</h3>
      <p>
        Bạn có thể sửa bản nháp hoặc tài liệu bị từ chối trước lần xuất bản đầu
        tiên.
      </p>
      <fieldset
        disabled={disabled}
        style={{ border: 0, padding: 0, minWidth: 0 }}
        className="learner-form"
      >
        <SkillPicker value={skillId} onChange={setSkillId} />
        <label>
          <span>Tiêu đề</span>
          <input
            name="title"
            required
            minLength={5}
            maxLength={150}
            defaultValue={material.title}
          />
        </label>
        <label>
          <span>Mô tả</span>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={3000}
            rows={5}
            defaultValue={material.description}
          />
        </label>
        <label>
          <span>Hình thức</span>
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value as "FREE" | "PAID")}
          >
            <option value="FREE">Miễn phí</option>
            <option value="PAID">Có phí</option>
          </select>
        </label>
        {access === "PAID" && (
          <label>
            <span>Giá (CR)</span>
            <input
              name="price"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              defaultValue={material.priceCredit}
            />
          </label>
        )}
        <p>
          Tệp hiện tại: {material.file?.originalFilename ?? "Chưa có"}. Chỉ chọn
          tệp nếu muốn thay thế.
        </p>
        <UploadControl
          endpoint="me/materials/files"
          maxBytes={20000000}
          accept=".pdf,.docx,.pptx,.xlsx"
          disabled={disabled}
          onUploaded={setFileId}
          onBusyChange={setUploading}
        />
        {fileId && (
          <>
            <Feedback
              variant="inline"
              error={file.error}
              loading={file.initialLoading}
              reload={file.reload}
              refreshing={!!(file.loading && !file.initialLoading)}
            />
            <p>
              Trạng thái tệp:{" "}
              <Status
                value={
                  file.data?.moderationStatus === "REVIEW_REQUIRED"
                    ? "REVIEW_REQUIRED"
                    : (file.data?.state ?? "PENDING")
                }
                label={
                  file.data?.moderationStatus === "REVIEW_REQUIRED"
                    ? "Cần kiểm duyệt thêm, chưa thể lưu tệp này"
                    : file.data?.state === "READY"
                      ? "Sẵn sàng"
                      : undefined
                }
              />
            </p>
            <LoadingButton
              type="button"
              className="btn"
              onClick={file.reload}
              loading={!!command.pending}
            >
              Kiểm tra tệp
            </LoadingButton>
            <label className="product-consent">
              <input type="checkbox" name="rights" required />
              <span>Tôi có quyền phân phối tệp thay thế.</span>
            </label>
          </>
        )}
        <MaterialCoverControl cover={cover} disabled={disabled} existing />
      </fieldset>
      <CommandFeedback command={command} />
      {command.uncertain && (
        <p>
          Chưa xác định kết quả lưu. Đóng editor và tải lại để đối chiếu phiên
          bản trước khi sửa tiếp.
        </p>
      )}
      <div className="learner-actions">
        <LoadingButton
          type="submit"
          className="btn btn-primary"
          disabled={
            disabled ||
            uploading ||
            cover.blocked ||
            !skillId ||
            (!!fileId && file.data?.state !== "READY")
          }
          loading={!!(command.pending || uploading)}
        >
          Lưu thay đổi
        </LoadingButton>
        <LoadingButton
          type="button"
          className="btn"
          disabled={command.pending}
          onClick={() => {
            reload();
            close();
          }}
          loading={!!command.pending}
        >
          Đóng và làm mới
        </LoadingButton>
      </div>
    </form>
  );
}
