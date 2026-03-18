import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { getRedirectUrl } from "@/lib/auth-redirect";
import { setLastUsedEmail } from "@/lib/last-email";
import { signInWithGoogle } from "@/lib/oauth-google";
import { isAppleAuthAvailable, signInWithApple } from "@/lib/oauth-apple";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";
import { trackEvent } from "@/lib/observability";

const UNAUTHORIZED_HINT =
  "In Supabase: Authentication → Providers → turn Email ON. Check Project Settings → API: use the anon public key and project URL in .env, then restart the app.";

export default function SignInScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const emailFromSplash = (params.email ?? "").trim().toLowerCase();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const theme = useTheme();
  const { session, sessionLoaded, setSessionFromAuth } = useSupabase();

  useEffect(() => {
    if (!emailFromSplash) router.replace("/(auth)");
  }, [emailFromSplash]);

  useEffect(() => {
    if (emailFromSplash) setLastUsedEmail(emailFromSplash);
  }, [emailFromSplash]);

  useEffect(() => {
    if (session && sessionLoaded && emailFromSplash) {
      if (__DEV__) {
        console.log("[auth] sign-in useEffect session→navigateAfterAuth", { hasSession: !!session });
      }
      // Defer navigation until after context has committed so index doesn't redirect to auth with stale session
      queueMicrotask(() => {
        navigateAfterAuth();
      });
    }
  }, [session, sessionLoaded, emailFromSplash]);

  const handleSignIn = async () => {
    if (!emailFromSplash || !password) {
      setErrorHint("Please enter your password.");
      return;
    }
    setLoading(true);
    setErrorHint(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailFromSplash,
        password,
      });
      if (error) throw error;
      // Update auth context immediately so root index sees session before we navigate
      if (data.session) {
        if (__DEV__) {
          console.log("[auth] sign-in setSessionFromAuth called");
        }
        // Update context; the useEffect will handle navigation when session state changes
        setSessionFromAuth(data.session);
        trackEvent("user_signed_in", { method: "password", platform: Platform.OS, source: "sign_in_screen" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      const isInvalidCreds =
        message.toLowerCase().includes("invalid login credentials") ||
        message.toLowerCase().includes("invalid_credentials") ||
        code === "invalid_credentials";
      const userMessage = is401
        ? UNAUTHORIZED_HINT
        : isInvalidCreds
          ? "Incorrect password or email. Please try again."
          : message;
      setErrorHint(userMessage);
      showAlert("Sign in failed", userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGetMagicLink = async () => {
    if (!emailFromSplash || magicLinkSending || magicLinkSent) return;
    setMagicLinkSending(true);
    setErrorHint(null);
    try {
      const redirectUrl = getRedirectUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email: emailFromSplash,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      showAlert(
        "Check your email",
        `We sent a magic link to ${emailFromSplash}. Tap it to set your password and sign in.`,
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      setErrorHint(is401 ? UNAUTHORIZED_HINT : message);
      showAlert("Error", is401 ? UNAUTHORIZED_HINT : message);
    } finally {
      setMagicLinkSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorHint(null);
    try {
      const session = await signInWithGoogle();
      if (session) {
        // Update context; the useEffect will handle navigation when session state changes
        setSessionFromAuth(session);
        trackEvent("user_signed_in", { method: "google", platform: Platform.OS, source: "sign_in_screen" });
      } else {
        setErrorHint("Google sign-in was cancelled or failed");
      }
    } catch (error) {
      console.error("[auth] Google sign-in error:", error);
      setErrorHint(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setErrorHint(null);
    try {
      const session = await signInWithApple();
      if (session) {
        setSessionFromAuth(session);
        trackEvent("user_signed_in", {
          method: "apple",
          platform: Platform.OS,
          source: "sign_in_screen",
        });
      } else {
        setErrorHint("Apple sign-in was cancelled or failed");
      }
    } catch (error) {
      console.error("[auth] Apple sign-in error:", error);
      setErrorHint(error instanceof Error ? error.message : "Apple sign-in failed");
    } finally {
      setAppleLoading(false);
    }
  };

  const canSubmit = Boolean(password);
  const socialLoading = googleLoading || appleLoading;
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.surface,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter your password for {emailFromSplash}
        </Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[inputStyle, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleSignIn}
            returnKeyType="go"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setPasswordVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
          >
            <Ionicons
              name={passwordVisible ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 },
          ]}
          onPress={handleSignIn}
          disabled={loading || !canSubmit}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={loading ? "Signing in" : "Sign In"}
          accessibilityState={{ disabled: loading || !canSubmit }}
          accessibilityHint={!canSubmit ? "Enter password to enable" : undefined}
        >
          {loading ? (
            <View style={styles.buttonRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Signing in…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>
        <TouchableOpacity
          style={[
            styles.googleButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={socialLoading || loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text style={[styles.googleButtonText, { color: theme.text }]}>
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </Text>
        </TouchableOpacity>
        {isAppleAuthAvailable() ? (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={socialLoading || loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Apple"
          >
            <Text style={styles.appleButtonText}>
              {appleLoading ? "Signing in..." : "Sign in with Apple"}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.linkButton, { borderColor: theme.border }]}
          onPress={handleGetMagicLink}
          disabled={loading || magicLinkSending || magicLinkSent}
          accessibilityRole="button"
          accessibilityLabel={
            magicLinkSent
              ? "Magic link sent"
              : magicLinkSending
                ? "Sending magic link"
                : "New user? Get a magic link to set your password"
          }
        >
          <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>
            {magicLinkSent
              ? `We sent a link to ${emailFromSplash}`
              : magicLinkSending
                ? "Sending…"
                : "New user? Get a magic link to set your password"}
          </Text>
        </TouchableOpacity>
        {errorHint ? (
          <Text
            style={[styles.errorHint, { color: theme.textMuted }]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {errorHint}
          </Text>
        ) : null}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, width: "100%" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, marginBottom: 8 },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    padding: 8,
  },
  button: { borderRadius: 14, padding: 16, alignItems: "center" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#fff",
    fontSize: 16,
  },
  errorHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 8,
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  linkButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    marginHorizontal: 12,
  },
  googleButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  googleButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
  },
  appleButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#000000",
    marginBottom: 12,
  },
  appleButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
