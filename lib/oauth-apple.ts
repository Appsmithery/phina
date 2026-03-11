import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * Sign in with Apple using the native iOS SDK.
 * Returns the Supabase session on success, null if cancelled.
 */
export async function signInWithApple() {
  if (Platform.OS !== "ios") return null;

  if (__DEV__) {
    console.log("[oauth-apple] Using native Apple Sign-In SDK path", {
      platform: Platform.OS,
    });
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("No identity token received from Apple");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });

  if (error) throw error;

  // Apple only provides fullName on the very first sign-in — save it immediately
  if (credential.fullName) {
    const { givenName, familyName, middleName } = credential.fullName;
    const parts = [givenName, middleName, familyName].filter(Boolean);
    if (parts.length > 0) {
      await supabase.auth.updateUser({
        data: {
          full_name: parts.join(" "),
          given_name: givenName ?? undefined,
          family_name: familyName ?? undefined,
        },
      });
    }
  }

  return data.session;
}

/**
 * Returns true when the native Apple auth button should be shown (iOS only).
 */
export function isAppleAuthAvailable() {
  return Platform.OS === "ios";
}
