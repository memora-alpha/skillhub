"use client";
import { LoadingButton } from "@/components/loading-button";
import { formText } from "../components/form-data";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { SkillPicker } from "../components/skill-picker";
import { UploadControl } from "../components/upload-control";
import type { Material } from "./account-types";
import { MaterialCoverControl, useMaterialCover } from "./material-cover";
export function MaterialShare() {
  const cover = useMaterialCover();
  const [skillId, setSkillId] = useState(""),
    [fileId, setFileId] = useState(""),
    [access, setAccess] = useState("FREE"),
    [created, setCreated] = useState<Material>();
  const { request } = useUserSession(),
    command = useUserCommand(),
    submit = useUserCommand();
  const file = useUserResource<{ fileId: string; state: string }>(
    fileId ? "me/materials/files/" + fileId : null,
  );
  return (
    <>
      <Back href="/learn/materials" />
      <PageHeading title="Chia sẻ tài liệu" />
      <div className="learner-two-columns">
        <Panel title="Thông tin tài liệu">
          {created ? (
            <>
              <p className="learner-notice">
                <output>Đã lưu bản nháp: {created.title}.</output>
              </p>
              <LoadingButton
                type="button"
                className="btn btn-primary"
                disabled={
                  submit.pending ||
                  submit.uncertain ||
                  created.status === "PENDING_REVIEW"
                }
                onClick={() => {
                  void submit
                    .run("submit:" + created.id, () =>
                      request<Material>(
                        "me/materials/" + created.id + "/submit",
                        {
                          method: "POST",
                          body: {
                            expectedListingVersion: created.listingVersion,
                          },
                        },
                      ),
                    )
                    .then((result) => {
                      if (result) setCreated(result.data);
                    });
                }}
                loading={!!submit.pending}
              >
                {created.status === "PENDING_REVIEW"
                  ? "Đã gửi duyệt"
                  : "Gửi duyệt tài liệu"}
              </LoadingButton>
              <CommandFeedback command={submit} />
              <p>
                <Link
                  className="learner-card-link"
                  href="/learn/materials/mine"
                >
                  Xem tài liệu của tôi →
                </Link>
              </p>
            </>
          ) : (
            <form
              className="learner-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const body = {
                  skillId,
                  title: formText(data, "title").trim(),
                  description: formText(data, "description").trim(),
                  accessType: access,
                  priceCredit:
                    access === "FREE" ? "0" : formText(data, "priceCredit"),
                  distributionRightsConfirmed: data.get("rights") === "on",
                  fileId,
                  ...(cover.coverFileId
                    ? { coverFileId: cover.coverFileId }
                    : {}),
                };
                const result = await command.run(JSON.stringify(body), () =>
                  request<Material>("me/materials", { method: "POST", body }),
                );
                if (result) setCreated(result.data);
              }}
            >
              <SkillPicker
                value={skillId}
                onChange={setSkillId}
                disabled={command.pending || command.uncertain}
              />
              <label>
                <span>Tiêu đề</span>
                <input
                  name="title"
                  minLength={5}
                  maxLength={150}
                  required
                  disabled={command.pending || command.uncertain}
                />
              </label>
              <label>
                <span>Mô tả</span>
                <textarea
                  name="description"
                  minLength={10}
                  maxLength={3000}
                  rows={5}
                  required
                  disabled={command.pending || command.uncertain}
                />
              </label>
              <label>
                <span>Hình thức chia sẻ</span>
                <select
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  disabled={command.pending || command.uncertain}
                >
                  <option value="FREE">Miễn phí</option>
                  <option value="PAID">Có phí</option>
                </select>
              </label>
              {access === "PAID" && (
                <label>
                  <span>Giá (Credit)</span>
                  <input
                    type="number"
                    name="priceCredit"
                    min="0.01"
                    step="0.01"
                    max="9999999999.99"
                    required
                    disabled={command.pending || command.uncertain}
                  />
                </label>
              )}
              <UploadControl
                endpoint="me/materials/files"
                maxBytes={20000000}
                accept=".pdf,.docx,.pptx,.xlsx"
                onUploaded={setFileId}
                disabled={command.pending || command.uncertain}
              />
              {fileId && (
                <div>
                  <Feedback
                    variant="inline"
                    loading={file.initialLoading}
                    error={file.error}
                    reload={file.reload}
                    refreshing={!!(file.loading && !file.initialLoading)}
                  />
                  <p>
                    Trạng thái tệp:{" "}
                    {file.data ? (
                      <Status
                        value={file.data.state}
                        label={
                          file.data.state === "READY" ? "Sẵn sàng" : undefined
                        }
                      />
                    ) : (
                      "Đang đọc trạng thái…"
                    )}
                  </p>
                  <LoadingButton
                    type="button"
                    className="btn"
                    onClick={file.reload}
                    disabled={file.loading}
                    loading={!!file.loading}
                  >
                    Kiểm tra tệp
                  </LoadingButton>
                </div>
              )}
              <MaterialCoverControl
                cover={cover}
                disabled={command.pending || command.uncertain}
              />
              <label className="product-consent">
                <input
                  type="checkbox"
                  name="rights"
                  required
                  disabled={command.pending || command.uncertain}
                />{" "}
                Tôi có quyền phân phối tài liệu này.
              </label>
              <CommandFeedback command={command} />
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                disabled={
                  !skillId ||
                  cover.blocked ||
                  file.data?.state !== "READY" ||
                  command.pending ||
                  command.uncertain
                }
                loading={!!command.pending}
              >
                Lưu bản nháp
              </LoadingButton>
            </form>
          )}
        </Panel>
        <Panel title="Chia sẻ có trách nhiệm">
          <p>Hỗ trợ PDF, DOCX, PPTX, XLSX tối đa 20 MB.</p>
          <p>
            Tài liệu được kiểm tra tệp và duyệt nội dung trước khi xuất hiện
            trong thư viện.
          </p>
          <p>Giá và quyền truy cập được backend xác nhận khi mua.</p>
        </Panel>
      </div>
    </>
  );
}
export { MyMaterials } from "./my-materials";
