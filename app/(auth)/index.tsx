import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const UNAUTHORIZED_HINT =
  "In Supabase: Authentication → Providers → turn Email ON. Check Project Settings → API: use the anon public key and project URL in .env, then restart the app.";

const MIN_PASSWORD_LENGTH = 6;

const LOGO_MAX_SIDE = 560;
const LOGO_MIN_SIDE = 320;
const LOGO_WIDTH_RATIO = 0.9;

export default function AuthScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const theme = useTheme();

  const logoSize = Math.max(
    LOGO_MIN_SIDE,
    Math.min(LOGO_MAX_SIDE, screenWidth * LOGO_WIDTH_RATIO, screenHeight * 0.5)
  );

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
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
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      if (data.session) {
        // Signed in immediately (e.g. Confirm email off)
        // onAuthStateChange will run; app/index will redirect
        setLoading(false);
        return;
      }
      Alert.alert(
        "Check your email",
        "We sent you a confirmation link. Tap it to activate your account, then sign in.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      const isAlreadyRegistered =
        message.toLowerCase().includes("already registered") ||
        message.toLowerCase().includes("user already exists");
      if (isAlreadyRegistered) {
        const hint = "An account with this email already exists. Use Sign In instead.";
        setErrorHint(hint);
        Alert.alert("Account exists", hint);
      } else {
        setErrorHint(is401 ? UNAUTHORIZED_HINT : message);
        Alert.alert("Error", is401 ? UNAUTHORIZED_HINT : message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorHint("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setErrorHint(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
      // Session set; app/index will redirect
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      setErrorHint(is401 ? UNAUTHORIZED_HINT : "Invalid email or password.");
      Alert.alert("Sign in failed", is401 ? UNAUTHORIZED_HINT : "Invalid email or password.");
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <View style={[styles.logoWrapper, { backgroundColor: theme.background }]}>
          <Image
            source={require("../../phina_logo_transparent.png")}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
            accessibilityLabel="Phína logo"
          />
        </View>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          Create an account or sign in
        </Text>
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
        <TextInput
          style={inputStyle}
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={inputStyle}
          placeholder="Confirm password"
          placeholderTextColor={theme.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonSecondary, { borderColor: theme.border }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={[styles.buttonSecondaryText, { color: theme.textSecondary }]}>
            Sign In
          </Text>
        </TouchableOpacity>
        {errorHint ? (
          <Text style={[styles.errorHint, { color: theme.textMuted }]}>{errorHint}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
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
  button: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#fff",
    fontSize: 16,
  },
  buttonSecondary: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  buttonSecondaryText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
  },
  errorHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
