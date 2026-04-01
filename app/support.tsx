import { Stack, router } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { PAGE_HORIZONTAL_PADDING, getScreenBottomPadding } from "@/lib/layout";
import { useTheme } from "@/lib/theme";

const SUPPORT_EMAIL = "support@appsmithery.co";

export default function SupportScreen() {
  const theme = useTheme();

  const openUrl = async (url: string) => {
    await Linking.openURL(url);
  };

  const openEmail = async () => {
    await openUrl(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: "Support" }} />
      <Text style={[styles.h1, { color: theme.text }]}>Support</Text>
      <Text style={[styles.updated, { color: theme.textMuted }]}>
        Questions, accessibility requests, privacy issues, or App Review follow-up
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.p, { color: theme.textSecondary }]}>
          Email us anytime at{" "}
          <Text style={{ color: theme.primary }} onPress={() => void openEmail()}>
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>
        <Text style={[styles.p, { color: theme.textSecondary }]}>
          To report inappropriate, unsafe, or inaccurate event, wine, or AI-generated
          content, use the in-app report actions when available or send the event or
          wine details by email.
        </Text>

        <TouchableOpacity
          style={[
            styles.primaryAction,
            { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => void openEmail()}
        >
          <Text style={styles.primaryActionText}>Email support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryAction,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          onPress={() =>
            router.push({
              pathname: "/feedback",
              params: { source: "support", screen: "/support" },
            })
          }
        >
          <Text style={[styles.secondaryActionText, { color: theme.text }]}>
            Send structured feedback
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.h2, { color: theme.text }]}>Helpful links</Text>
        <TouchableOpacity
          style={[
            styles.linkRow,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
          onPress={() => router.push("/privacy")}
        >
          <Text style={[styles.linkLabel, { color: theme.text }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.linkRow,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
          onPress={() => router.push("/terms")}
        >
          <Text style={[styles.linkLabel, { color: theme.text }]}>Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.linkRow,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
          onPress={() => router.push("/account/delete")}
        >
          <Text style={[styles.linkLabel, { color: theme.text }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingBottom: getScreenBottomPadding(0),
  },
  h1: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 8,
  },
  updated: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  h2: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 12,
  },
  p: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  primaryAction: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
  secondaryAction: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryActionText: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  linkLabel: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
});
