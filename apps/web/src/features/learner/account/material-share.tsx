"use client";
import { formText } from "../components/form-data";
import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { SkillPicker } from "../components/skill-picker";
import { UploadControl } from "../components/upload-control";
import type { Material } from "./account-types";
import { MaterialEditor, editableMaterial } from "./material-editor";
export function MaterialShare() {
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
              <button
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
                        { method: "POST" },
                      ),
                    )
                    .then((result) => {
                      if (result) setCreated(result.data);
                    });
                }}
              >
                {created.status === "PENDING_REVIEW"
                  ? "Đã gửi duyệt"
                  : "Gửi duyệt tài liệu"}
              </button>
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
                    loading={file.loading}
                    error={file.error}
                    reload={file.reload}
                  />
                  <p>
                    Trạng thái tệp:{" "}
                    {file.data ? (
                      <Status value={file.data.state} />
                    ) : (
                      "Đang đọc trạng thái…"
                    )}
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={file.reload}
                    disabled={file.loading}
                  >
                    Kiểm tra tệp
                  </button>
                </div>
              )}
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
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  !skillId ||
                  file.data?.state !== "READY" ||
                  command.pending ||
                  command.uncertain
                }
              >
                Lưu bản nháp
              </button>
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
export function MyMaterials() {
  const [editing, setEditing] = useState<string | null>(null),
    [archiving, setArchiving] = useState<string | null>(null),
    [inspectionError, setInspectionError] = useState<string>();
  const query =
      useUserResource<(Material & { rejectReason: string | null })[]>(
        "me/materials",
      ),
    { request } = useUserSession(),
    command = useUserCommand();
  return (
    <>
      <Back href="/learn/materials" />
      <PageHeading
        title="Tài liệu của tôi"
        action={
          <Link className="btn btn-primary" href="/learn/materials/new">
            + Chia sẻ tài liệu
          </Link>
        }
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <CommandFeedback command={command} />
      {command.uncertain && (
        <button
          className="btn"
          onClick={async () => {
            try {
              await request<Material[]>("me/materials");
              command.resetAfterRead();
              setArchiving(null);
              setInspectionError(undefined);
              query.reload();
            } catch (cause) {
              setInspectionError(
                cause instanceof Error
                  ? cause.message
                  : "Chưa đối chiếu được trạng thái.",
              );
            }
          }}
        >
          Đối chiếu trạng thái tài liệu
        </button>
      )}
      {inspectionError && (
        <p className="learner-error" role="alert">
          {inspectionError}
        </p>
      )}
      <div className="learner-stack">
        {query.data?.map((material) => (
          <Panel key={material.id}>
            <div className="learner-card-top">
              <h2>{material.title}</h2>
              <Status value={material.status} />
            </div>
            <p>{material.description}</p>
            {material.rejectReason && (
              <p className="learner-error">{material.rejectReason}</p>
            )}
            <p>
              {material.accessType === "FREE"
                ? "Miễn phí"
                : material.priceCredit + " CR"}{" "}
              · Phiên bản {material.listingVersion}
            </p>
            {editing === material.id && editableMaterial(material.status) ? (
              <MaterialEditor
                key={material.id + ":" + material.listingVersion}
                material={material}
                close={() => setEditing(null)}
                reload={query.reload}
              />
            ) : (
              editableMaterial(material.status) && (
                <div className="learner-actions">
                  <button
                    className="btn"
                    disabled={command.pending || command.uncertain}
                    onClick={() => {
                      setArchiving(null);
                      setEditing(material.id);
                    }}
                  >
                    Sửa tài liệu
                  </button>
                  <button
                    className="btn"
                    disabled={command.pending || command.uncertain}
                    onClick={() => {
                      setEditing(null);
                      setArchiving(material.id);
                    }}
                  >
                    Lưu trữ
                  </button>
                </div>
              )
            )}
            {archiving === material.id && (
              <div className="learner-notice">
                <p>
                  Lưu trữ “{material.title}”? Tài liệu sẽ ngừng phân phối. Hiện
                  chưa có thao tác khôi phục; quyền của người đã mua do máy chủ
                  quản lý.
                </p>
                <button
                  className="btn btn-primary"
                  disabled={command.pending || command.uncertain}
                  onClick={() =>
                    void command
                      .run("archive:" + material.id, () =>
                        request("me/materials/" + material.id + "/archive", {
                          method: "POST",
                        }),
                      )
                      .then((result) => {
                        if (result) {
                          setArchiving(null);
                          query.reload();
                        }
                      })
                  }
                >
                  Xác nhận lưu trữ
                </button>{" "}
                <button
                  className="btn"
                  disabled={command.pending}
                  onClick={() => {
                    setArchiving(null);
                    query.reload();
                  }}
                >
                  Đóng và làm mới
                </button>
              </div>
            )}
            {material.status === "DRAFT" && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={command.pending || command.uncertain}
                onClick={() => {
                  void command.run("submit:" + material.id, () =>
                    request("me/materials/" + material.id + "/submit", {
                      method: "POST",
                    }),
                  );
                }}
              >
                Gửi duyệt
              </button>
            )}
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.data?.length && (
        <Empty>Bạn chưa chia sẻ tài liệu nào.</Empty>
      )}
    </>
  );
}
