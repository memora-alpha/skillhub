"use client";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserResource } from "../hooks/use-user-resource";
import { CommandFeedback, Feedback, Status } from "../components/common";
import { SkillPicker } from "../components/skill-picker";
import { UploadControl } from "../components/upload-control";
import type { Material } from "./account-types";
import { formText } from "../components/form-data";

export const editableMaterial = (status: string) =>
  ["DRAFT", "REJECTED", "PENDING_REVIEW", "PUBLISHED"].includes(status);
export function MaterialEditor({
  material,
  close,
  reload,
}: Readonly<{
  material: Material;
  close: () => void;
  reload: () => void;
}>) {
  const { request } = useUserSession(),
    command = useUserCommand();
  const [skillId, setSkillId] = useState(material.skillId);
  const [access, setAccess] = useState(material.accessType);
  const [fileId, setFileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const file = useUserResource<{ state: string }>(
    fileId ? "me/materials/files/" + fileId : null,
  );
  const disabled = command.pending || command.uncertain;
  return (
    <form
      className="learner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = {
          expectedListingVersion: material.listingVersion,
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
        const result = await command.run(JSON.stringify(body), () =>
          request("me/materials/" + material.id, { method: "PATCH", body }),
        );
        if (result) {
          reload();
          close();
        }
      }}
    >
      <h3>Sửa tài liệu · phiên bản {material.listingVersion}</h3>
      <p>
        Sửa tài liệu đã xuất bản sẽ đưa nội dung về chờ duyệt. Người đã mua vẫn
        giữ phiên bản tệp đã mua.
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
              error={file.error}
              loading={file.loading}
              reload={file.reload}
            />
            <p>
              Trạng thái tệp: <Status value={file.data?.state ?? "PENDING"} />
            </p>
            <button type="button" className="btn" onClick={file.reload}>
              Kiểm tra tệp
            </button>
            <label className="product-consent">
              <input type="checkbox" name="rights" required />
              <span>Tôi có quyền phân phối tệp thay thế.</span>
            </label>
          </>
        )}
      </fieldset>
      <CommandFeedback command={command} />
      {command.uncertain && (
        <p>
          Chưa xác định kết quả lưu. Đóng editor và tải lại để đối chiếu phiên
          bản trước khi sửa tiếp.
        </p>
      )}
      <div className="learner-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            disabled ||
            uploading ||
            !skillId ||
            (!!fileId && file.data?.state !== "READY")
          }
        >
          Lưu thay đổi
        </button>
        <button
          type="button"
          className="btn"
          disabled={command.pending}
          onClick={() => {
            reload();
            close();
          }}
        >
          Đóng và làm mới
        </button>
      </div>
    </form>
  );
}
