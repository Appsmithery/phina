import { router } from "expo-router";
import { getPendingJoinEventId, clearPendingJoinEventId } from "./pending-join";

export async function navigateAfterAuth(): Promise<void> {
  const pendingId = await getPendingJoinEventId();
  if (pendingId) {
    await clearPendingJoinEventId();
    router.replace(`/join/${pendingId}`);
  } else {
    router.replace("/(tabs)");
  }
}
