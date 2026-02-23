import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "phina_pending_join";

function isWebStorageAvailable(): boolean {
  return Platform.OS === "web" && typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

export async function setPendingJoinEventId(eventId: string): Promise<void> {
  if (isWebStorageAvailable()) {
    globalThis.localStorage.setItem(KEY, eventId);
    return;
  }
  await SecureStore.setItemAsync(KEY, eventId);
}

export async function getPendingJoinEventId(): Promise<string | null> {
  if (isWebStorageAvailable()) {
    return globalThis.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearPendingJoinEventId(): Promise<void> {
  if (isWebStorageAvailable()) {
    globalThis.localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
