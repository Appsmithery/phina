import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@/types/database";

// Avoid throwing at module load so the Metro bundler doesn't get a 500 when building the bundle.
// If these are missing, auth calls will fail at runtime and the app still loads (see supabase-context .catch).
// Env: use EXPO_PUBLIC_* per https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
// Key: anon (EXPO_PUBLIC_SUPABASE_ANON_KEY) or publishable (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) from Connect dialog.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function getAuthStorage() {
  if (Platform.OS === "web" && typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return {
      getItem: (key: string) => Promise.resolve(globalThis.localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        globalThis.localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        globalThis.localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
  }
  return {
    getItem: async (key: string) => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (e) {
        if (__DEV__) {
          console.warn("[Supabase auth storage] getItem failed (e.g. user interaction not allowed):", e);
        }
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (e) {
        if (__DEV__) {
          console.warn("[Supabase auth storage] setItem failed:", e);
        }
      }
    },
    removeItem: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        if (__DEV__) {
          console.warn("[Supabase auth storage] removeItem failed:", e);
        }
      }
    },
  };
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // Only parse session from URL on web (e.g. magic link redirect). Off on native per Expo quickstart.
    detectSessionInUrl: Platform.OS === "web",
  },
});
