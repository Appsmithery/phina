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
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "c778f4f2-6c6b-4e80-a6df-f86be328a7c8",
    },
  },
  plugins: ["expo-router", "expo-camera"],
});
