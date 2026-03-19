import { useEffect, useRef, useState } from "react";
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
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { getEmailConfirmationRedirectUrl, getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
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
const AUTH_SESSION_RECOVERY_DELAYS_MS = [0, 150, 400, 900] as const;

type AuthMode = "sign-in" | "sign-up";


function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getSignUpValidationMessage(email: string, password: string, confirmPassword: string): string | null {
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedEmail && !password && !confirmPassword) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters and confirm your password.`;
  }
  if (!trimmedEmail) {
    return "Please enter your email.";
  }
  if (!password) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!confirmPassword) {
    return "Please confirm your password.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const theme = useTheme();
  const { session, sessionLoaded, setSessionFromAuth } = useSupabase();
  const authNavigationTriggeredRef = useRef(false);

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
    if (!session) {
      authNavigationTriggeredRef.current = false;
      return;
    }

    if (!sessionLoaded || authNavigationTriggeredRef.current) {
      return;
    }

    authNavigationTriggeredRef.current = true;
    setConfirmationEmail(null);
    setConfirmationStatus(null);
    void navigateAfterAuth();
  }, [session, sessionLoaded]);

  const finalizeAuthSuccess = async (nextSession: Session) => {
    authNavigationTriggeredRef.current = true;
    setConfirmationEmail(null);
    setConfirmationStatus(null);
    setSessionFromAuth(nextSession);
    await navigateAfterAuth();
  };

  const recoverAuthSession = async (): Promise<Session | null> => {
    for (const waitMs of AUTH_SESSION_RECOVERY_DELAYS_MS) {
      if (waitMs > 0) {
        await delay(waitMs);
      }

      const {
        data: { session: recoveredSession },
      } = await supabase.auth.getSession();

      if (recoveredSession) {
        return recoveredSession;
      }
    }

    return null;
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorHint(null);
    setConfirmationStatus(null);
    if (nextMode === "sign-up") {
      setConfirmationEmail(null);
    }
    if (nextMode === "sign-in") {
      setConfirmPassword("");
    }
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    setErrorHint(null);
    setConfirmationStatus(null);
    if (confirmationEmail && normalizeEmail(nextEmail) !== confirmationEmail) {
      setConfirmationEmail(null);
    }
  };

  const handlePasswordChange = (nextPassword: string) => {
    setPassword(nextPassword);
    setErrorHint(null);
    setConfirmationStatus(null);
  };

  const handleConfirmPasswordChange = (nextPassword: string) => {
    setConfirmPassword(nextPassword);
    setErrorHint(null);
    setConfirmationStatus(null);
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
      const recoveredSession = data.session ?? await recoverAuthSession();
      if (!recoveredSession) {
        setErrorHint("Sign-in did not return a session. Please try again.");
        return;
      }
      await finalizeAuthSuccess(recoveredSession);
    } catch (e: unknown) {
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
    setConfirmationStatus(null);

    try {
      await setLastUsedEmail(trimmedEmail);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: getEmailConfirmationRedirectUrl(),
        },
      });
      if (error) throw error;

      const recoveredSession = data.session ?? await recoverAuthSession();
      if (recoveredSession) {
        await finalizeAuthSuccess(recoveredSession);
        return;
      }

      setConfirmationEmail(trimmedEmail);
      setConfirmationStatus("Check your email to confirm your account, then sign in with your password.");
      setMode("sign-in");
      setPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
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
      const redirectUrl = getPasswordResetRedirectUrl();
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

  const handleResendConfirmation = async () => {
    const trimmedEmail = normalizeEmail(confirmationEmail ?? email);
    if (!trimmedEmail) {
      setErrorHint("Enter your email first to resend confirmation.");
      return;
    }

    setResendLoading(true);
    setErrorHint(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: getEmailConfirmationRedirectUrl(),
        },
      });
      if (error) throw error;
      setConfirmationEmail(trimmedEmail);
      setConfirmationStatus("Confirmation email sent. Open the latest email to finish creating your account.");
      showAlert(
        "Confirmation sent",
        "We sent another confirmation email. Open it to finish creating your account.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErrorHint(message);
      showAlert("Resend failed", message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorHint(null);
    try {
      const session = await signInWithGoogle();
      if (session) {
        await finalizeAuthSuccess(session);
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
        await finalizeAuthSuccess(session);
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

  const socialLoading = googleLoading || appleLoading;
  const busy = loading || resetLoading || resendLoading;
  const signUpValidationMessage = mode === "sign-up"
    ? getSignUpValidationMessage(email, password, confirmPassword)
    : null;
  const formMessage = mode === "sign-up"
    ? (errorHint ?? signUpValidationMessage ?? confirmationStatus)
    : (errorHint ?? confirmationStatus);
  const canSubmit = mode === "sign-in"
    ? Boolean(normalizeEmail(email) && password)
    : signUpValidationMessage == null;
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
            onChangeText={handleEmailChange}
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
            onChangeText={handlePasswordChange}
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
                onChangeText={handleConfirmPasswordChange}
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

          {formMessage ? (
            <Text
              style={[
                styles.formMessage,
                {
                  color: errorHint
                    ? theme.primary
                    : mode === "sign-up" || confirmationStatus
                      ? theme.textSecondary
                      : theme.textSecondary,
                },
              ]}
              accessibilityRole="text"
              accessibilityLiveRegion="polite"
            >
              {formMessage}
            </Text>
          ) : null}

          {confirmationEmail ? (
            <TouchableOpacity
              onPress={handleResendConfirmation}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Resend confirmation email"
            >
              <Text style={[styles.inlineLink, styles.resendLink, { color: theme.primary, opacity: busy ? 0.6 : 1 }]}>
                {resendLoading ? "Sending confirmation..." : `Resend confirmation to ${confirmationEmail}`}
              </Text>
            </TouchableOpacity>
          ) : null}

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
  formMessage: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  resendLink: {
    textAlign: "center",
    marginTop: 0,
    marginBottom: 12,
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
