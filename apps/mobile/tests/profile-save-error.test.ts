import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { profileSaveErrorMessage } from "../src/features/profile/utils/profile-save-error";

test("ambiguous profile saves preserve the draft without claiming a rollback", () => {
  for (const error of [
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 503),
  ]) {
    const message = profileSaveErrorMessage(error);
    assert.match(message, /Chưa xác nhận được kết quả lưu/);
    assert.match(message, /Bản nháp vẫn được giữ/);
    assert.match(message, /kiểm tra hồ sơ trước khi lưu lại/);
  }
});

test("rejected profile saves keep actionable validation or permission feedback", () => {
  assert.match(
    profileSaveErrorMessage(new AppError("http", 400)),
    /chưa hợp lệ/,
  );
  assert.match(
    profileSaveErrorMessage(new AppError("http", 403)),
    /không có quyền/,
  );
  assert.match(profileSaveErrorMessage(new AppError("http", 429)), /đợi/);
});
