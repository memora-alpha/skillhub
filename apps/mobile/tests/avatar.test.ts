import assert from "node:assert/strict";
import test from "node:test";
import type { ImagePickerAsset } from "expo-image-picker";
import axios from "axios";
import {
  avatarImage,
  avatarFormData,
  AVATAR_MAX_BYTES,
} from "../src/features/profile/utils/avatar-draft";
import { avatarSaveErrorMessage } from "../src/features/profile/utils/avatar-save-error";
import { parseAvatarUpload } from "../src/features/account/api/avatar-contracts";
import { createAccountApi } from "../src/features/account/api/account-api";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";

const asset: ImagePickerAsset = {
  uri: "file:///picked/avatar.png",
  width: 100,
  height: 100,
  mimeType: "image/png",
  fileSize: 1024,
};
const id = "a1111111-1111-4111-8111-111111111111";

test("avatar validates supported formats, byte and decoded pixel limits", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp"])
    assert.equal(
      avatarImage({ ...asset, mimeType: mime, fileSize: AVATAR_MAX_BYTES })
        .mime,
      mime,
    );
  for (const draft of [
    { ...asset, mimeType: "image/heic" },
    { ...asset, fileSize: AVATAR_MAX_BYTES + 1 },
    { ...asset, fileSize: 0 },
    { ...asset, width: 5000, height: 5000 },
  ])
    assert.throws(() => avatarImage(draft));
  assert.equal(
    avatarImage({ ...asset, mimeType: undefined }).mime,
    "image/png",
  );
});

test("web avatar multipart uses image field and the actual file bytes", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "private-name.png", {
    type: "image/png",
  });
  const image = avatarImage({ ...asset, file, mimeType: "image/jpeg" });
  const body = avatarFormData(image);
  assert.deepEqual([...body.keys()], ["image"]);
  const uploaded = body.get("image") as File;
  assert.equal(uploaded.type, "image/png");
  assert.equal(uploaded.name, "avatar.png");
  assert.deepEqual(
    new Uint8Array(await uploaded.arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
});

test("avatar status parser rejects unsupported states and private payload fields", () => {
  for (const status of ["QUARANTINED", "CLEAN", "REJECTED", "DELETED"])
    assert.deepEqual(
      parseAvatarUpload({ assetId: id, status, storageKey: "private" }),
      { assetId: id, status },
    );
  for (const bad of [
    { assetId: id, status: "SUCCESS" },
    { assetId: "../other", status: "CLEAN" },
  ])
    assert.throws(() => parseAvatarUpload(bad), AppError);
});

test("protected multipart survives 401 refresh without JSON conversion; status/delete contracts work", async () => {
  const body = avatarFormData(
    avatarImage({
      ...asset,
      file: new File(["bytes"], "avatar.png", { type: "image/png" }),
    }),
  );
  let uploadCalls = 0;
  const http = axios.create({
    adapter: async (config) => {
      let status = 200;
      let data: unknown;
      if (config.method === "post") {
        assert.equal(config.url, "/me/avatar");
        assert.equal(config.data, body);
        assert.equal(config.headers.getContentType(), false);
        status = ++uploadCalls === 1 ? 401 : 202;
        data = { success: true, data: { assetId: id, status: "QUARANTINED" } };
      } else if (config.method === "delete") {
        assert.equal(config.url, "/me/avatar");
        status = 204;
      } else {
        assert.equal(config.url, `/me/avatar/uploads/${id}`);
        data = { success: true, data: { assetId: id, status: "CLEAN" } };
      }
      return { config, data, status, statusText: "", headers: {} };
    },
  });
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  let token = "expired";
  client.bindSession({
    generation: 1,
    getToken: async () => token,
    renew: async () => {
      token = "rotated";
    },
    expire: async () => {},
  });
  const api = createAccountApi(client);
  assert.equal((await api.uploadAvatar(body)).status, "QUARANTINED");
  assert.equal(uploadCalls, 2);
  assert.equal((await api.getAvatarUpload(id)).status, "CLEAN");
  await api.removeAvatar();
});

test("avatar status cannot be associated with a different upload", async () => {
  const api = createAccountApi({
    bindSession() {},
    request: async () => ({ assetId: id, status: "CLEAN" }),
  });
  await assert.rejects(
    api.getAvatarUpload("b1111111-1111-4111-8111-111111111111"),
    AppError,
  );
});

test("avatar errors distinguish size/format from an ambiguous save result", () => {
  assert.match(avatarSaveErrorMessage(new AppError("http", 413)), /5MB/);
  assert.match(
    avatarSaveErrorMessage(new AppError("http", 415)),
    /JPG, PNG hoặc WebP/,
  );
  assert.match(
    avatarSaveErrorMessage(new AppError("network")),
    /kiểm tra hồ sơ/,
  );
  assert.match(
    avatarSaveErrorMessage(new AppError("http", 503)),
    /ảnh đã chọn vẫn được giữ/,
  );
});
