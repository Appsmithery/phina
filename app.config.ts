import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Phína",
  slug: "phina",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "phina",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./phina-logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "co.appsmithery.phina",
    associatedDomains: ["applinks:phina.appsmithery.co"],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
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
    favicon: "./assets/favicon.png",
    name: "Phína",
    shortName: "Phína",
    description: "Wine club hosting app with OCR label capture and anonymous ratings",
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co",
    eas: {
      projectId: "your-eas-project-id",
    },
  },
  plugins: ["expo-router", "expo-camera"],
});
