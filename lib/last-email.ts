import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "phina_last_used_email";

function isWebStorageAvailable(): boolean {
  return Platform.OS === "web" && typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

export async function setLastUsedEmail(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;
  if (isWebStorageAvailable()) {
    globalThis.localStorage.setItem(KEY, trimmed);
    return;
  }
  await SecureStore.setItemAsync(KEY, trimmed);
}

export async function getLastUsedEmail(): Promise<string | null> {
  if (isWebStorageAvailable()) {
    return globalThis.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearLastUsedEmail(): Promise<void> {
  if (isWebStorageAvailable()) {
    globalThis.localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
