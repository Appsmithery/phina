export type JoinStorePlatform = "ios" | "android";

export interface JoinStoreTarget {
  platform: JoinStorePlatform;
  storeName: string;
  url: string;
  placeholderMessage: string;
}

const IOS_APP_STORE_PLACEHOLDER_URL = "https://apps.apple.com/us/charts/iphone";
const ANDROID_PLAY_STORE_PLACEHOLDER_URL = "https://play.google.com/store/apps";

const JOIN_STORE_TARGETS: Record<JoinStorePlatform, JoinStoreTarget> = {
  ios: {
    platform: "ios",
    storeName: "App Store",
    url: IOS_APP_STORE_PLACEHOLDER_URL,
    placeholderMessage:
      "Phina is not published on the App Store yet. This opens a placeholder App Store destination for now.",
  },
  android: {
    platform: "android",
    storeName: "Google Play",
    url: ANDROID_PLAY_STORE_PLACEHOLDER_URL,
    placeholderMessage:
      "Phina is not published on Google Play yet. This opens a placeholder Google Play destination for now.",
  },
};

export function getJoinStoreTarget(userAgent: string): JoinStoreTarget | null {
  const platform = detectJoinStorePlatform(userAgent);
  return platform ? JOIN_STORE_TARGETS[platform] : null;
}

export function isMobileWebUserAgent(userAgent: string): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

function detectJoinStorePlatform(userAgent: string): JoinStorePlatform | null {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("android")) {
    return "android";
  }

  if (/iphone|ipad|ipod/.test(normalized)) {
    return "ios";
  }

  if (normalized.includes("mobile")) {
    return "ios";
  }

  return null;
}
