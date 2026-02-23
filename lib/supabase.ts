import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@/types/database";

// Avoid throwing at module load so the Metro bundler doesn't get a 500 when building the bundle.
// If these are missing, auth calls will fail at runtime and the app still loads (see supabase-context .catch).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
