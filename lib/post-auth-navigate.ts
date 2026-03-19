import { router } from "expo-router";
import { POST_AUTH_ROUTE } from "./post-auth-route";

export async function navigateAfterAuth(): Promise<void> {
  router.replace(POST_AUTH_ROUTE);
}
