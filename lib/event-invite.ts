import { Platform } from "react-native";
import * as Updates from "expo-updates";

const APP_BASE_URL =
  (process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co").replace(
    /\/+$/,
    "",
  );

export type EventInviteDetails = {
  url: string;
  isPreviewNativeInvite: boolean;
};

export function getEventInviteDetails(eventId: string): EventInviteDetails {
  const channel = Updates.channel;
  const isNative = Platform.OS !== "web";
  const isPreviewNativeInvite =
    isNative && (channel === "preview" || channel === "development");

  return {
    url: isPreviewNativeInvite
      ? `phina://join/${eventId}`
      : `${APP_BASE_URL}/join/${eventId}`,
    isPreviewNativeInvite,
  };
}
