import assert from "node:assert/strict";
import test from "node:test";
import { matchingRequestOptions } from "../src/features/learning-requests/utils/request-option-search";
import { requestTimeZoneNote } from "../src/features/learning-requests/utils/request-time-zone";
import { deviceTimeZone } from "../src/features/learning-requests/schemas/request-preferences";
import { requestDefaults } from "../src/features/learning-requests/schemas/request-form";

test("offering search matches Vietnamese accents, uppercase and separate words without changing IDs/order", () => {
  const options = [
    { id: "english", label: "Tiếng Anh · Trung cấp · Đã xác minh" },
    { id: "japanese", label: "Tiếng Nhật · Cơ bản" },
    { id: "java", label: "Java · Nâng cao" },
  ];
  assert.deepEqual(matchingRequestOptions(options, "  TIENG   trung "), [
    options[0],
  ]);
  assert.deepEqual(matchingRequestOptions(options, "da xac minh"), [
    options[0],
  ]);
  assert.deepEqual(
    matchingRequestOptions(options, "Tiếng"),
    options.slice(0, 2),
  );
  assert.deepEqual(matchingRequestOptions(options, "guitar"), []);
  assert.deepEqual(matchingRequestOptions(options, " "), options);
});
test("timezone caption hides the device IANA field and distinguishes a saved foreign schedule", () => {
  const local = requestTimeZoneNote("Asia/Ho_Chi_Minh", "Asia/Saigon");
  assert.match(local, /Giờ theo thiết bị.*GMT\+7/);
  assert.doesNotMatch(local, /Asia/);
  const foreign = requestTimeZoneNote("America/New_York", "Asia/Ho_Chi_Minh");
  assert.match(foreign, /Giờ theo lịch đã lưu.*America\/New York/);
  assert.doesNotMatch(foreign, /Giờ theo thiết bị/);
  assert.match(requestTimeZoneNote("Invalid/Zone"), /Kiểm tra cài đặt/);
  assert.equal(requestDefaults().timeZone, deviceTimeZone());
});
