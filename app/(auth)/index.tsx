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

const LOGO_MAX_SIDE = 560;
const LOGO_MIN_SIDE = 320;
const LOGO_WIDTH_RATIO = 0.9;

export default function AuthScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const theme = useTheme();

  const logoSize = Math.max(
    LOGO_MIN_SIDE,
    Math.min(LOGO_MAX_SIDE, screenWidth * LOGO_WIDTH_RATIO, screenHeight * 0.5)
  );

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setErrorHint(null);
    const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: Platform.OS === "web" ? `${appUrl}/` : undefined,
        },
      });
      if (error) throw error;
      Alert.alert(
        "Check your email",
        "We sent you a magic link. Tap it to sign in.",
        [{ text: "OK" }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const is401 = message.includes("401") || message.toLowerCase().includes("unauthorized");
      setErrorHint(is401 ? UNAUTHORIZED_HINT : message);
      Alert.alert("Error", is401 ? UNAUTHORIZED_HINT : message);
    } finally {
      setLoading(false);
    }
  };

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
          Enter your email to get a sign-in link
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
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
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={sendMagicLink}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send magic link</Text>
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
  },
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
