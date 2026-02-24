import { Platform } from "react-native";

export function getRedirectUrl(): string | undefined {
  if (Platform.OS !== "web") return undefined;
  const baseUrl = (process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co").replace(
    /\/+$/,
    ""
  );
  return `${baseUrl}/set-password`;
}
