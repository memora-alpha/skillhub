import { userFetch, UserApiError } from "../api/client";
const storageKey = "skillhub-web-push-v1",
  ownerCache = "skillhub-push-owner-v1",
  ownerUrl = "/__skillhub_push_owner__";
type Binding = { userId: string; tokenId: string; token: string };
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
export const pushConfigured = !!(
  config.apiKey &&
  config.projectId &&
  config.messagingSenderId &&
  config.appId &&
  vapidKey
);
export function pushBinding(): Binding | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return value &&
      typeof value.userId === "string" &&
      typeof value.token === "string" &&
      typeof value.tokenId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
async function messaging() {
  const [app, sdk] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await sdk.isSupported()))
    throw new Error(
      "Trình duyệt này chưa hỗ trợ thông báo đẩy. Bạn vẫn xem được thông báo trong ứng dụng.",
    );
  const instance =
    app.getApps().find((item) => item.name === "skillhub-web-push") ??
    app.initializeApp(config, "skillhub-web-push");
  return { sdk, instance: sdk.getMessaging(instance) };
}
async function clearOwner() {
  if ("caches" in window) {
    const cache = await caches.open(ownerCache);
    await cache.delete(ownerUrl);
  }
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration(
      "/firebase-messaging-sw.js",
    );
    for (const notification of (await registration?.getNotifications()) ?? [])
      notification.close();
  }
}
let running: Promise<void> | null = null;
async function serial(work: () => Promise<void>) {
  const prior = running;
  const result = (async () => {
    await prior?.catch(() => undefined);
    await work();
  })();
  running = result;
  try {
    await result;
  } finally {
    if (running === result) running = null;
  }
}
export async function disableWebPush(userId?: string) {
  return serial(async () => {
    // Clear the worker's owner before any network call, including an offline logout.
    await clearOwner();
    const binding = pushBinding();
    let failure: unknown;
    if (binding && (!userId || binding.userId === userId)) {
      try {
        await userFetch("notifications/push-tokens/" + binding.tokenId, {
          method: "DELETE",
        });
      } catch (cause) {
        if (!(cause instanceof UserApiError && cause.status === 404))
          failure = cause;
      }
    }
    try {
      if (pushConfigured) {
        const { sdk, instance } = await messaging();
        await sdk.deleteToken(instance);
      }
    } catch (cause) {
      failure ??= cause;
    }
    localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event("skillhub-push-changed"));
    if (failure)
      throw new Error(
        "Đã tắt hiển thị push trên trình duyệt. Chưa xác nhận hủy token với máy chủ; bật lại để đồng bộ khi kết nối ổn định.",
      );
  });
}
export async function enableWebPush(
  userId: string,
  permissionAlreadyGranted = false,
) {
  // Permission is requested synchronously from the user's click, before SDK imports.
  if (!pushConfigured)
    throw new Error("Thông báo đẩy chưa được cấu hình trên bản web này.");
  if (
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  )
    throw new Error(
      "Trình duyệt chưa hỗ trợ push hoặc trang chưa chạy qua HTTPS.",
    );
  const permission = permissionAlreadyGranted
    ? Notification.permission
    : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "Quyền thông báo đang bị chặn. Mở cài đặt quyền của trang để cho phép."
        : "Bạn chưa cấp quyền thông báo.",
    );
  return serial(async () => {
    await clearOwner();
    const { sdk, instance } = await messaging();
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;
    // BE accepts an FCM registration token, not a Firebase Installation ID (FID).
    const token = await sdk.getToken(instance, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token)
      throw new Error("Chưa lấy được token thông báo. Vui lòng thử lại.");
    const identity = (await userFetch<{ userId: string }>("session")).data;
    if (identity.userId !== userId)
      throw new Error(
        "Phiên đăng nhập đã thay đổi. Tải lại trang trước khi bật push.",
      );
    const old = pushBinding();
    const { data } = await userFetch<{ id: string }>(
      "notifications/push-tokens",
      { method: "POST", body: { token } },
    );
    if (!data || typeof data.id !== "string")
      throw new Error("Máy chủ chưa xác nhận token thông báo.");
    // A rotated token is registered first; revoke only this user's old registration.
    if (old?.userId === userId && old.tokenId !== data.id)
      await userFetch("notifications/push-tokens/" + old.tokenId, {
        method: "DELETE",
      }).catch(() => undefined);
    const check = (await userFetch<{ userId: string }>("session")).data;
    if (check.userId !== userId) {
      await sdk.deleteToken(instance);
      throw new Error("Phiên đã đổi trong khi bật thông báo.");
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify({ userId, tokenId: data.id, token }),
    );
    const cache = await caches.open(ownerCache);
    await cache.put(
      ownerUrl,
      new Response(JSON.stringify({ userId }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    window.dispatchEvent(new Event("skillhub-push-changed"));
  });
}
