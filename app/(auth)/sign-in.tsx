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
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const UNAUTHORIZED_HINT =
  "In Supabase: Authentication → Providers → turn Email ON. Check Project Settings → API: use the anon public key and project URL in .env, then restart the app.";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const theme = useTheme();

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
      // Session set; navigate into app so root index can redirect to (tabs)/profile
      router.replace("/");
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
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: theme.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          Enter your email and password
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
          onSubmitEditing={handleSignIn}
          returnKeyType="go"
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sign In"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
        {errorHint ? (
          <Text style={[styles.errorHint, { color: theme.textMuted }]}>{errorHint}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  back: { alignSelf: "flex-start", marginBottom: 16 },
  backText: { fontSize: 16 },
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
  button: { borderRadius: 14, padding: 16, alignItems: "center" },
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
});
