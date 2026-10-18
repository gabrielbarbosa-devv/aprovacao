import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Delivery = {
  notification_id: string;
  title: string;
  body: string;
  target_url: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  attempt_no: number;
};

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expectedSecret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expectedSecret || !providedSecret || !(await secretsMatch(expectedSecret, providedSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!url || !serviceRoleKey) return new Response("Scheduler is not configured", { status: 503 });

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: queueError } = await supabase.rpc("process_notification_queue");
  if (queueError) return new Response("Notification processing failed", { status: 500 });

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return Response.json({ processed: true, push: "not_configured" });
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data, error } = await supabase.rpc("claim_notification_push_batch");
  if (error) return new Response("Push queue claim failed", { status: 500 });
  const deliveries = (data ?? []) as Delivery[];
  const grouped = new Map<string, Delivery[]>();
  for (const delivery of deliveries) grouped.set(delivery.notification_id, [...(grouped.get(delivery.notification_id) ?? []), delivery]);

  let sent = 0;
  for (const [notificationId, subscriptions] of grouped) {
    let delivered = false;
    for (const subscription of subscriptions) {
      try {
        const response = await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret } },
          JSON.stringify({ title: subscription.title, body: subscription.body, targetUrl: safeTarget(subscription.target_url) }),
          { TTL: 3600, urgency: "normal" },
        );
        delivered = true;
        await supabase.rpc("log_notification_push_attempt", { p_notification_id: notificationId, p_subscription_id: subscription.subscription_id, p_attempt_no: subscription.attempt_no, p_outcome: "sent", p_response_status: response.statusCode ?? 201 });
      } catch (error) {
        const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
        const responseStatus = typeof status === "number" && status >= 100 && status <= 599 ? status : null;
        if (status === 404 || status === 410) {
          await supabase.from("notification_push_subscriptions").delete().eq("id", subscription.subscription_id);
        }
        await supabase.rpc("log_notification_push_attempt", { p_notification_id: notificationId, p_subscription_id: subscription.subscription_id, p_attempt_no: subscription.attempt_no, p_outcome: status === 404 || status === 410 ? "subscription_removed" : "failed", p_response_status: responseStatus });
      }
    }
    if (delivered) {
      const { error: updateError } = await supabase.rpc("mark_notification_push_sent", { p_notification_id: notificationId });
      if (!updateError) sent += 1;
    }
  }
  return Response.json({ processed: true, claimed: grouped.size, sent });
});

function safeTarget(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function secretsMatch(expected: string, provided: string): Promise<boolean> {
  const [expectedHash, providedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const providedBytes = new Uint8Array(providedHash);
  let difference = expectedBytes.length ^ providedBytes.length;
  for (let index = 0; index < expectedBytes.length; index += 1) difference |= expectedBytes[index]! ^ providedBytes[index]!;
  return difference === 0;
}
