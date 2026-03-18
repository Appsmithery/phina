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
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const MIN_PASSWORD_LENGTH = 8;

export default function SetPasswordScreen() {
  const { session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      // Brief delay so Supabase can process the reset callback before we redirect.
      const t = setTimeout(() => {
        router.replace("/(auth)");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [sessionLoaded, session]);

  const handleSetPassword = async () => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigateAfterAuth(), 1000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErrorHint(message);
      showAlert("Error", message);
    } finally {
      setLoading(false);
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

  if (!sessionLoaded || !session) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading…</Text>
      </View>
    );
  }

  const handleSignInInstead = () => {
    const email = session?.user?.email?.trim();
    if (email) {
      router.replace({
        pathname: "/(auth)",
        params: { email, mode: "sign-in" },
      });
    } else {
      router.replace("/(auth)");
    }
  };

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
        <Text style={[styles.title, { color: theme.text }]}>Set your password</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          Choose a password for future sign-ins.
        </Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[inputStyle, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordsVisible}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setPasswordsVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={passwordsVisible ? "Hide passwords" : "Show passwords"}
          >
            <Ionicons
              name={passwordsVisible ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        </View>
        <TextInput
          style={inputStyle}
          placeholder="Confirm password"
          placeholderTextColor={theme.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!passwordsVisible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {success ? (
          <Text
            style={[styles.successHint, { color: theme.textSecondary }]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            Password set. Signing you in…
          </Text>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleSetPassword}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={loading ? "Setting password" : "Set password"}
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.buttonText}>Setting…</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Set password</Text>
            )}
          </TouchableOpacity>
        )}
        {errorHint ? (
          <Text
            style={[styles.errorHint, { color: theme.textMuted }]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {errorHint}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.linkButton, { borderColor: theme.border }]}
          onPress={handleSignInInstead}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Already have an account? Sign in with password"
        >
          <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>
            Already have an account? Sign in with password
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkButtonSecondary, { borderColor: theme.border }]}
          onPress={() => router.replace("/")}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Go to app without changing password"
        >
          <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>
            Go to app
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
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
  loadingText: { marginTop: 8, fontSize: 16 },
  title: { fontFamily: "Montserrat_600SemiBold", fontSize: 24, marginBottom: 8 },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
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
  successHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
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
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 14,
  },
  linkButtonSecondary: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  linkButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
  },
});
