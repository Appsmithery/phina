import { Platform } from "react-native";

export function getRedirectUrl(): string | undefined {
  if (Platform.OS === "web") {
    const baseUrl = (process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co").replace(/\/+$/, "");
    return `${baseUrl}/set-password`;
  }
  // Native: redirect to the app scheme so the deep-link handler in _layout.tsx
  // can intercept the access_token / refresh_token and create the session.
  return "phina://";
}
