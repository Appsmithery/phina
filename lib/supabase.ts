import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
