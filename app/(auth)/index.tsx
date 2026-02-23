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
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
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
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
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
            source={require("../../Gemini_Generated_Image_nd308snd308snd30.png")}
            style={styles.logo}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 24,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  logoWrapper: {
    alignSelf: "center",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  logo: {
    width: 160,
    height: 160,
    alignSelf: "center",
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 16,
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
});
