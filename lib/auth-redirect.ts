import { Platform } from "react-native";
import { NATIVE_MAGIC_LINK_NEXT_ROUTE, NATIVE_MAGIC_LINK_REDIRECT_URL } from "./auth-callback";

function getAppUrl(): string {
  return (process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co").replace(/\/+$/, "");
}

export function getPasswordResetRedirectUrl(): string {
  const appUrl = getAppUrl();

  if (Platform.OS === "web") {
    return `${appUrl}/set-password`;
  }

  // Native: route through the web callback intermediary, then hand off to the
  // app's explicit custom scheme callback so dev, preview, and production
  // builds all use the same return URL shape.
  const params = new URLSearchParams({
    nativeRedirect: NATIVE_MAGIC_LINK_REDIRECT_URL,
    next: NATIVE_MAGIC_LINK_NEXT_ROUTE,
  });
  return `${appUrl}/callback?${params.toString()}`;
}

export function getEmailConfirmationRedirectUrl(): string {
  const appUrl = getAppUrl();

  if (Platform.OS === "web") {
    return `${appUrl}/callback`;
  }

  const params = new URLSearchParams({
    nativeRedirect: NATIVE_MAGIC_LINK_REDIRECT_URL,
    next: "/",
  });
  return `${appUrl}/callback?${params.toString()}`;
}

export function getRedirectUrl(): string {
  return getPasswordResetRedirectUrl();
}
