// Service worker for Web Push (PWA). Handles push events and notification click.
// Used when the app is run as a web app; register from the app with navigator.serviceWorker.register("/sw.js").

self.addEventListener("push", (event) => {
  const promise = (async () => {
    let payload = { title: "Phína", body: "", data: {} };
    if (event.data) {
      try {
        const parsed = await event.data.json();
        payload = { ...payload, ...parsed };
      } catch {
        payload.body = event.data.text() || "";
      }
    }
    const title = payload.title || "Phína";
    const options = {
      body: payload.body || "New notification",
      data: payload.data || {},
      icon: "/favicon.ico",
    };
    await self.registration.showNotification(title, options);
  })();
  event.waitUntil(promise);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (path && typeof path === "string") {
    const fullUrl = path.startsWith("http") ? path : new URL(path, self.location.origin).href;
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            return client.navigate(fullUrl).then(() => client.focus());
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullUrl);
        }
      })
    );
  }
});
