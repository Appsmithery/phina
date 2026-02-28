import { useState, useRef, useEffect } from "react";
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
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { getRedirectUrl } from "@/lib/auth-redirect";
import { setLastUsedEmail } from "@/lib/last-email";
import { useSupabase } from "@/lib/supabase-context";
import { signInWithGoogle } from "@/lib/oauth-google";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const UNAUTHORIZED_HINT =
  "In Supabase: Authentication → Providers → turn Email ON. Check Project Settings → API: use the anon public key and project URL in .env, then restart the app.";

const RESEND_COOLDOWN_SECONDS = 60;
const LOGO_MAX_SIDE = 672;
const LOGO_MIN_SIDE = 384;
const LOGO_WIDTH_RATIO = 0.9;

export default function AuthScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const theme = useTheme();
  const { setSessionFromAuth } = useSupabase();

  const logoSize = Math.max(
    LOGO_MIN_SIDE,
    Math.min(LOGO_MAX_SIDE, screenWidth * LOGO_WIDTH_RATIO, screenHeight * 0.6)
  );

  const startCooldown = () => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setResendCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldownSeconds((s) => {
        if (s <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!magicLinkSentTo && cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
      setResendCooldownSeconds(0);
    }
  }, [magicLinkSentTo]);

  const sendMagicLink = async (trimmedEmail: string): Promise<boolean> => {
    const redirectUrl = getRedirectUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) throw error;
    setMagicLinkSentTo(trimmedEmail);
    setErrorHint(null);
    startCooldown();
    return true;
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorHint("Please enter your email.");
      return;
    }
    setLoading(true);
    setErrorHint(null);
    try {
      await sendMagicLink(trimmedEmail);
      showAlert(
        "Check your email",
        "We sent you a magic link. Tap it to set your password and sign in.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      setErrorHint(is401 ? UNAUTHORIZED_HINT : message);
      showAlert("Error", is401 ? UNAUTHORIZED_HINT : message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!magicLinkSentTo || resendCooldownSeconds > 0) return;
    setLoading(true);
    setErrorHint(null);
    try {
      await sendMagicLink(magicLinkSentTo);
      showAlert("Link sent again", "Check your inbox for the magic link.", [{ text: "OK" }]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErrorHint(message);
    } finally {
      setLoading(false);
    }
  };

  const canSignIn = Boolean(email.trim());
  const handleSignIn = async () => {
    if (!canSignIn) return;
    const trimmedEmail = email.trim().toLowerCase();
    await setLastUsedEmail(trimmedEmail);
    router.push({
      pathname: "/(auth)/sign-in",
      params: { email: trimmedEmail },
    });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorHint(null);
    try {
      const session = await signInWithGoogle();
      if (session) {
        setSessionFromAuth(session);
        await navigateAfterAuth();
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
        <Text style={[styles.subtitle, { color: theme.text }]}>
          {magicLinkSentTo
            ? "Check your email"
            : "Enter your email to get a sign-in link"}
        </Text>
        {magicLinkSentTo ? (
          <>
            <Text
              style={[styles.successHint, { color: theme.textSecondary }]}
              accessibilityRole="text"
              accessibilityLiveRegion="polite"
            >
              We sent a magic link to {magicLinkSentTo}. Check your inbox and tap the link to set
              your password.
            </Text>
            <TouchableOpacity
              style={[styles.linkButton, { borderColor: theme.border }]}
              onPress={() => setMagicLinkSentTo(null)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Use a different email"
            >
              <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>
                Use a different email
              </Text>
            </TouchableOpacity>
            {resendCooldownSeconds > 0 ? (
              <Text
                style={[styles.cooldownHint, { color: theme.textMuted }]}
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
              >
                You can resend in {resendCooldownSeconds} seconds
              </Text>
            ) : (
              <TouchableOpacity
                style={[styles.linkButton, { borderColor: theme.border }]}
                onPress={handleResend}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Resend magic link"
              >
                <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>
                  Resend link
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TextInput
              style={inputStyle}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                  opacity: canSignIn && !loading ? 1 : 0.6,
                },
              ]}
              onPress={canSignIn && !loading ? handleSignUp : undefined}
              disabled={!canSignIn || loading}
              accessibilityRole="button"
              accessibilityLabel="Send magic link"
            >
              <Text style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>
                Send magic link
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
              disabled={googleLoading || loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
            >
              <Text style={[styles.googleButtonText, { color: theme.text }]}>
                {googleLoading ? "Signing in..." : "Sign in with Google"}
              </Text>
            </TouchableOpacity>
          </>
        )}
        {!magicLinkSentTo ? (
          <View style={styles.nudgeRow}>
            <Text
              style={[styles.nudgeHint, { color: theme.textMuted }]}
              accessibilityRole="text"
            >
              Enter your email above to{" "}
            </Text>
            <TouchableOpacity
              onPress={canSignIn && !loading ? handleSignIn : undefined}
              disabled={!canSignIn || loading}
              accessibilityRole="link"
              accessibilityLabel="Sign in with password"
              accessibilityState={{ disabled: !canSignIn || loading }}
            >
              <Text
                style={[
                  styles.nudgeLink,
                  {
                    color: theme.primary,
                    opacity: canSignIn && !loading ? 1 : 0.6,
                  },
                ]}
              >
                sign in with password
              </Text>
            </TouchableOpacity>
            <Text
              style={[styles.nudgeHint, { color: theme.textMuted }]}
              accessibilityRole="text"
            >
              .
            </Text>
          </View>
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
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
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
  },
  cooldownHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  nudgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 8,
  },
  nudgeHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
  nudgeLink: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  successHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  linkButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
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
  },
});
