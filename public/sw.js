self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }
  const title = typeof payload.title === "string" ? payload.title : "Operação Aprovação";
  const body = typeof payload.body === "string" ? payload.body : "Você tem uma atualização nos seus estudos.";
  const targetUrl = typeof payload.targetUrl === "string" && payload.targetUrl.startsWith("/") && !payload.targetUrl.startsWith("//") ? payload.targetUrl : "/";
  event.waitUntil(self.registration.showNotification(title, { body, data: { targetUrl } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.targetUrl;
  const safeUrl = typeof targetUrl === "string" && targetUrl.startsWith("/") && !targetUrl.startsWith("//") ? targetUrl : "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(safeUrl).then(() => existing.focus());
    return self.clients.openWindow(safeUrl);
  }));
});
