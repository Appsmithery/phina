import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { getRedirectUrl } from "@/lib/auth-redirect";
import { getLastUsedEmail, setLastUsedEmail } from "@/lib/last-email";
import { useSupabase } from "@/lib/supabase-context";
import { signInWithGoogle } from "@/lib/oauth-google";
import { signInWithApple, isAppleAuthAvailable } from "@/lib/oauth-apple";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const UNAUTHORIZED_HINT =
  "In Supabase: Authentication → Providers → turn Email ON. Check Project Settings → API: use the anon public key and project URL in .env, then restart the app.";

const INVALID_CREDENTIALS_HINT = "Incorrect email or password. Please try again.";
const DUPLICATE_ACCOUNT_HINT = "An account with this email already exists. Sign in or reset your password.";
const MIN_PASSWORD_LENGTH = 8;
const LOGO_MAX_SIDE = 672;
const LOGO_MIN_SIDE = 384;
const LOGO_WIDTH_RATIO = 0.9;

type AuthMode = "sign-in" | "sign-up";
type PendingNavigation = "sign-in" | "sign-up" | "google" | "apple" | null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getInitialMode(mode?: string | string[]): AuthMode {
  return mode === "sign-up" ? "sign-up" : "sign-in";
}

function isInvalidCredentialsError(message: string, code?: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("invalid login credentials") ||
    lowered.includes("invalid_credentials") ||
    code === "invalid_credentials"
  );
}

function isDuplicateEmailError(message: string, code?: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("user already registered") ||
    lowered.includes("already registered") ||
    lowered.includes("already exists") ||
    code === "user_already_exists"
  );
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const initialParamEmail = typeof params.email === "string" ? normalizeEmail(params.email) : "";
  const [mode, setMode] = useState<AuthMode>(getInitialMode(params.mode));
  const [email, setEmail] = useState(initialParamEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const theme = useTheme();
  const { session, sessionLoaded, setSessionFromAuth } = useSupabase();

  const logoSize = Math.max(
    LOGO_MIN_SIDE,
    Math.min(LOGO_MAX_SIDE, screenWidth * LOGO_WIDTH_RATIO, screenHeight * 0.6)
  );

  useEffect(() => {
    setMode(getInitialMode(params.mode));
  }, [params.mode]);

  useEffect(() => {
    if (initialParamEmail) {
      setEmail(initialParamEmail);
      return;
    }

    let active = true;
    getLastUsedEmail()
      .then((lastEmail) => {
        if (active && lastEmail) {
          setEmail(lastEmail);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [initialParamEmail]);

  useEffect(() => {
    if (!pendingNavigation || !sessionLoaded || !session) {
      return;
    }

    setPendingNavigation(null);
    queueMicrotask(() => {
      navigateAfterAuth();
    });
  }, [pendingNavigation, session, sessionLoaded]);

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorHint(null);
    if (nextMode === "sign-in") {
      setConfirmPassword("");
    }
  };

  const handleSignIn = async () => {
    const trimmedEmail = normalizeEmail(email);
    if (!trimmedEmail || !password) {
      setErrorHint("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setErrorHint(null);

    try {
      await setLastUsedEmail(trimmedEmail);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      if (!data.session) {
        setErrorHint("Sign-in did not return a session. Please try again.");
        return;
      }
      setSessionFromAuth(data.session);
      setPendingNavigation("sign-in");
    } catch (e: unknown) {
      setPendingNavigation(null);
      const message = e instanceof Error ? e.message : String(e);
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      const userMessage = is401
        ? UNAUTHORIZED_HINT
        : isInvalidCredentialsError(message, code)
          ? INVALID_CREDENTIALS_HINT
          : message;
      setErrorHint(userMessage);
      showAlert("Sign in failed", userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = normalizeEmail(email);
    if (!trimmedEmail) {
      setErrorHint("Please enter your email.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorHint(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorHint("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorHint(null);

    try {
      await setLastUsedEmail(trimmedEmail);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      if (data.session) {
        setSessionFromAuth(data.session);
        setPendingNavigation("sign-up");
        return;
      }

      setMode("sign-in");
      setPassword("");
      setConfirmPassword("");
      showAlert(
        "Check your email",
        "Your account was created. Check your email to confirm your address, then sign in with your password.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      setPendingNavigation(null);
      const message = e instanceof Error ? e.message : String(e);
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      const userMessage = is401
        ? UNAUTHORIZED_HINT
        : isDuplicateEmailError(message, code)
          ? DUPLICATE_ACCOUNT_HINT
          : message;
      setErrorHint(userMessage);
      showAlert("Create account failed", userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = normalizeEmail(email);
    if (!trimmedEmail) {
      setErrorHint("Enter your email first to reset your password.");
      return;
    }

    setResetLoading(true);
    setErrorHint(null);

    try {
      await setLastUsedEmail(trimmedEmail);
      const redirectUrl = getRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      showAlert(
        "Check your email",
        "We sent a password reset link. Open it to choose a new password.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      const userMessage = is401 ? UNAUTHORIZED_HINT : message;
      setErrorHint(userMessage);
      showAlert("Reset password failed", userMessage);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorHint(null);
    try {
      const session = await signInWithGoogle();
      if (session) {
        setSessionFromAuth(session);
        setPendingNavigation("google");
      } else {
        setErrorHint("Google sign-in was cancelled or failed");
      }
    } catch (error) {
      setPendingNavigation(null);
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
        setPendingNavigation("apple");
      } else {
        setErrorHint("Apple sign-in was cancelled or failed");
      }
    } catch (error) {
      setPendingNavigation(null);
      console.error("[auth] Apple sign-in error:", error);
      setErrorHint(error instanceof Error ? error.message : "Apple sign-in failed");
    } finally {
      setAppleLoading(false);
    }
  };

  const socialLoading = googleLoading || appleLoading;
  const busy = loading || resetLoading;
  const canSubmit = Boolean(normalizeEmail(email) && password);
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
          <View style={styles.logoWrapper}>
            <Image
              source={require("@/assets/phina_logo.png")}
              style={[styles.logo, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
              accessibilityLabel="Phína logo"
            />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>
            {mode === "sign-in" ? "Welcome back" : "Create your account"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === "sign-in"
              ? "Sign in with your email and password."
              : "Create an account with your email and password."}
          </Text>

          <View style={[styles.modeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === "sign-in" && { backgroundColor: theme.primary },
              ]}
              onPress={() => handleModeChange("sign-in")}
              accessibilityRole="button"
              accessibilityLabel="Switch to sign in"
            >
              <Text
                style={[
                  styles.modeButtonText,
                  { color: mode === "sign-in" ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === "sign-up" && { backgroundColor: theme.primary },
              ]}
              onPress={() => handleModeChange("sign-up")}
              accessibilityRole="button"
              accessibilityLabel="Switch to create account"
            >
              <Text
                style={[
                  styles.modeButtonText,
                  { color: mode === "sign-up" ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMAIL ADDRESS</Text>
          <TextInput
            style={inputStyle}
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PASSWORD</Text>
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />

          {mode === "sign-up" ? (
            <>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>CONFIRM PASSWORD</Text>
              <TextInput
                style={inputStyle}
                placeholder="Confirm password"
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
            </>
          ) : (
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={[styles.inlineLink, { color: theme.primary, opacity: busy ? 0.6 : 1 }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.primary,
                opacity: canSubmit && !busy ? 1 : 0.6,
              },
            ]}
            onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
            disabled={!canSubmit || busy}
            accessibilityRole="button"
            accessibilityLabel={mode === "sign-in" ? "Sign in" : "Create account"}
          >
            <Text
              style={[styles.primaryButtonText, { color: "#FFFFFF" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {loading ? (mode === "sign-in" ? "Signing in..." : "Creating account...") : mode === "sign-in" ? "Sign In" : "Create Account"}
            </Text>
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
            disabled={socialLoading || busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Text
              style={[styles.googleButtonText, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
          >
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </Text>
          </TouchableOpacity>
          {isAppleAuthAvailable() ? (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={socialLoading || busy}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Apple"
            >
              <Text
                style={styles.appleButtonText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {appleLoading ? "Signing in..." : "Sign in with Apple"}
              </Text>
            </TouchableOpacity>
          ) : null}

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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
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
  logoWrapper: {
    alignSelf: "center",
    marginBottom: 12,
  },
  logo: {
    alignSelf: "center",
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  modeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  inputLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  inlineLink: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    textAlign: "right",
    marginTop: -4,
    marginBottom: 16,
    textDecorationLine: "underline",
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    width: "100%",
    textAlign: "center",
  },
  errorHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 8,
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
    width: "100%",
    textAlign: "center",
  },
  appleButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center" as const,
    backgroundColor: "#000000",
    marginBottom: 12,
  },
  appleButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    width: "100%",
    textAlign: "center",
  },
});
