import { router } from "expo-router";

export async function navigateAfterAuth(): Promise<void> {
  router.replace("/");
}
