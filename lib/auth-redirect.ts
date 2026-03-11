import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";

export function getRedirectUrl(): string | undefined {
  const appUrl = (process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co").replace(/\/+$/, "");

  if (Platform.OS === "web") {
    return `${appUrl}/set-password`;
  }

  // Native: route through the web callback intermediary because Supabase
  // doesn't reliably redirect to non-HTTP custom URL schemes (phina://).
  // The callback page at /callback detects the nativeRedirect param and
  // forwards auth params (code or tokens) to the native app via deep link.
  const nativeRedirectUrl = AuthSession.makeRedirectUri();
  return `${appUrl}/callback?nativeRedirect=${encodeURIComponent(nativeRedirectUrl)}`;
}
