import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { Stack, router } from "expo-router";
import { PAGE_HORIZONTAL_PADDING, getScreenBottomPadding } from "@/lib/layout";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import { deleteCurrentAccount } from "@/lib/account-deletion";
import { supabase } from "@/lib/supabase";

const DELETE_CONFIRMATION = "DELETE";

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const [confirmationText, setConfirmationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const supportUrl = `${process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co"}/delete-account`;

  const handleDelete = async () => {
    if (confirmationText.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      showAlert("Confirmation required", `Type ${DELETE_CONFIRMATION} to continue.`);
      return;
    }

    setSubmitting(true);
    try {
      await deleteCurrentAccount();
      await supabase.auth.signOut().catch(() => {});
      showAlert(
        "Account deleted",
        "Your account and associated data have been scheduled for deletion.",
        [{ text: "OK", onPress: () => router.replace("/(auth)") }]
      );
    } catch (error) {
      showAlert(
        "Could not delete account",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: "Delete Account" }} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Delete your account</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          This permanently deletes your Phina account and removes the personal data
          tied to it, including your profile, event participation, wines, ratings,
          and feedback history.
        </Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          Purchased billing records may still be retained where required for tax,
          fraud, or payment-provider compliance. Public legal details are available at{" "}
          <Text style={{ color: theme.primary }} onPress={() => Linking.openURL(supportUrl)}>
            /delete-account
          </Text>
          .
        </Text>
        <Text style={[styles.label, { color: theme.text }]}>
          Type {DELETE_CONFIRMATION} to confirm
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={confirmationText}
          onChangeText={setConfirmationText}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
          placeholder={DELETE_CONFIRMATION}
          placeholderTextColor={theme.textMuted}
        />
        <TouchableOpacity
          style={[
            styles.deleteButton,
            { backgroundColor: "#B55A5A", opacity: submitting ? 0.7 : 1 },
          ]}
          onPress={handleDelete}
          disabled={submitting}
        >
          <Text style={styles.deleteButtonText}>
            {submitting ? "Deleting..." : "Delete account"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.border }]}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: getScreenBottomPadding(0),
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 16,
  },
  deleteButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
});
