/* Receives FCM Web Push through the browser Push API. No app secrets or auth
   tokens live in this worker. Never render the payload of a previous account. */
const ownerCache = "skillhub-push-owner-v1";
const ownerUrl = "/__skillhub_push_owner__";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ownerCache);
      const owner = await (await cache.match(ownerUrl))?.json();
      if (!owner?.userId) return;
      // Session cookies are HttpOnly. Validate the current actor server-side and
      // fail closed when logged out, expired, offline or switched to another role.
      const readActor = async () => {
        let response = await fetch("/api/user/session", {
          credentials: "same-origin",
          cache: "no-store",
        });
        // A closed tab may outlive the access cookie. Use the same rotation lock
        // as the app, and never renew a browser whose opt-in has been cleared.
        const bound = await (await cache.match(ownerUrl))?.json();
        if (response.status === 401 && bound?.userId === owner.userId) {
          response = await fetch("/api/user/session/refresh", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
        }
        return response;
      };
      const response = self.navigator?.locks
        ? await self.navigator.locks.request("skillhub-session", readActor)
        : await readActor();
      if (!response.ok) return;
      const identity = await response.json();
      if (!identity.success || identity.data?.userId !== owner.userId) return;
      // Recheck binding after the fetch: logout can race an in-flight push.
      const current = await (await cache.match(ownerUrl))?.json();
      if (current?.userId !== owner.userId) return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows)
        client.postMessage({ type: "SKILLHUB_PUSH_RECEIVED" });
      if (windows.some((client) => client.visibilityState === "visible"))
        return;
      await self.registration.showNotification("SkillHub", {
        body: "Bạn có cập nhật mới. Mở Thông báo để xem chi tiết.",
        tag: "skillhub-update",
        data: { userId: owner.userId },
      });
    })().catch(() => undefined),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const url = new URL("/learn/notifications", self.location.origin).href;
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ownerCache);
      await cache.delete(ownerUrl);
      for (const client of await self.clients.matchAll({ type: "window" }))
        client.postMessage({ type: "SKILLHUB_PUSH_EXPIRED" });
    })(),
  );
});
