import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Decode a base64url-encoded string to Uint8Array (for VAPID public key).
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Register for Web Push on web: register service worker, subscribe with VAPID public key,
 * save subscription JSON to members.push_token.
 */
async function registerWebPush(userId: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker || !navigator.serviceWorker.register) {
    return;
  }
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const pushManager = registration.pushManager;
  if (!pushManager || !pushManager.subscribe) {
    return;
  }
  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidPublicKey) {
    console.warn("EXPO_PUBLIC_VAPID_PUBLIC_KEY is not set; skipping Web Push registration.");
    return;
  }
  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = base64UrlToUint8Array(vapidPublicKey);
  } catch (e) {
    console.warn("Invalid VAPID public key:", e);
    return;
  }
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  let finalPermission = permission;
  if (permission !== "granted") {
    if (typeof Notification !== "undefined" && Notification.requestPermission) {
      finalPermission = (await Notification.requestPermission()) as NotificationPermission;
    }
    if (finalPermission !== "granted") return;
  }
  const subscription = await pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });
  const subscriptionJson = JSON.stringify(subscription.toJSON());
  const { error } = await supabase.from("members").update({ push_token: subscriptionJson }).eq("id", userId);
  if (error) console.warn("Failed to save push subscription:", error.message);
}

/**
 * Register for push notifications and save the token to members.push_token.
 * - On web: Web Push (service worker + VAPID), subscription JSON stored in push_token.
 * - On native: Expo Push, ExponentPushToken stored in push_token.
 * Call when the user is signed in (e.g. after fetchMember in supabase-context).
 */
export async function registerPushTokenIfNeeded(userId: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      await registerWebPush(userId);
    } catch (e) {
      console.warn("Web Push registration failed:", e);
    }
    return;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;
    const projectId =
      typeof Constants.expoConfig?.extra?.eas?.projectId === "string" &&
      Constants.expoConfig.extra.eas.projectId.trim() !== ""
        ? Constants.expoConfig.extra.eas.projectId.trim()
        : undefined;
    if (!projectId) {
      console.warn(
        "Expo push: no projectId (extra.eas.projectId). Set EXPO_PUBLIC_EAS_PROJECT_ID or fallback in app.config.ts."
      );
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) return;
    const { error } = await supabase.from("members").update({ push_token: token }).eq("id", userId);
    if (error) console.warn("Failed to save push token:", error.message);
  } catch (e) {
    console.warn("Push registration failed:", e);
  }
}
