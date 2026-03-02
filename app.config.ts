import { ExpoConfig, ConfigContext } from "expo/config";

const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "appsmithery",
  name: "Phína",
  slug: "phina",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "phina",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  runtimeVersion: { policy: "appVersion" },
  icon: "./phina_favicon.png",
  splash: {
    image: "./phina_logo.png",
    resizeMode: "contain",
    backgroundColor: "#F2EFE9",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "co.appsmithery.phina",
    associatedDomains: ["applinks:phina.appsmithery.co"],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Phína uses your camera to scan wine bottle labels and extract wine details automatically.",
      NSPhotoLibraryUsageDescription: "Phína lets you select a photo from your library to update a wine's label image.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./phina_favicon.png",
      backgroundColor: "#ffffff",
    },
    package: "co.appsmithery.phina",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "phina.appsmithery.co", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    favicon: "./phina_favicon.png",
    name: "Phína",
    shortName: "Phína",
    description: "Wine club hosting app with OCR label capture and anonymous ratings",
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "c778f4f2-6c6b-4e80-a6df-f86be328a7c8",
    },
  },
  plugins: [
    "expo-router",
    "expo-camera",
    "expo-web-browser",
    "@react-native-community/datetimepicker",
    ["@sentry/react-native/expo", {
      url: "https://sentry.io/",
      project: "phina",
      organization: "appsmithery",
    }],
    // Only include the native Google Sign-In plugin when the iOS URL scheme is configured.
    // Set EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME in .env once you have the iOS OAuth client ID
    // from Google Cloud Console (reversed client ID: com.googleusercontent.apps.YOUR_ID).
    ...(iosUrlScheme
      ? [["@react-native-google-signin/google-signin", { iosUrlScheme }] as [string, unknown]]
      : []),
  ],
});
