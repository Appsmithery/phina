import { Stack } from "expo-router";
import { ScrollView, Text, View, StyleSheet, Linking } from "react-native";
import { PAGE_HORIZONTAL_PADDING, getScreenBottomPadding } from "@/lib/layout";
import { useTheme } from "@/lib/theme";

export default function TermsScreen() {
  const theme = useTheme();

  const link = (text: string, url: string) => (
    <Text style={{ color: theme.primary }} onPress={() => Linking.openURL(url)}>
      {text}
    </Text>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: "Terms of Service" }} />
      <Text style={[styles.h1, { color: theme.text }]}>Terms of Service</Text>
      <Text style={[styles.updated, { color: theme.textMuted }]}>Last updated: February 28, 2026</Text>

      <Text style={[styles.p, { color: theme.textSecondary }]}>
        These Terms of Service ("Terms") govern your use of the Phína mobile application and website (the "Service") operated by Phína ("we", "us", or "our"). By using the Service you agree to these Terms.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>1. Eligibility</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        You must be of legal drinking age in your jurisdiction to use Phína. By creating an account, you represent that you meet this requirement.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>2. Accounts</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        You are responsible for maintaining the security of your account credentials. You agree to provide accurate information and to keep your email address current. We may suspend or terminate accounts that violate these Terms.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>3. Acceptable Use</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>You agree not to:</Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Use the Service for any unlawful purpose.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Upload content that is offensive, harmful, or infringes on others' rights.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Attempt to access other users' accounts or data without authorization.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Interfere with or disrupt the Service or its infrastructure.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Use automated scripts or bots to access the Service.</Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>4. Your Content</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        You retain ownership of the content you create (wine entries, tasting notes, photos, ratings). By posting content to the Service, you grant us a limited license to store, display, and process it as necessary to operate the Service.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        You are responsible for any content you upload and represent that you have the right to share it.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>5. Events and Ratings</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Event hosts manage their own events and are responsible for the conduct of their events. Ratings submitted during rating rounds are anonymous to other participants. We do not guarantee the accuracy of AI-extracted wine label information.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>6. Intellectual Property</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        The Service, including its design, code, branding, and original content, is owned by us and protected by intellectual property laws. You may not copy, modify, or distribute any part of the Service without our written permission.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>7. Third-Party Services</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        The Service integrates with third-party providers (Supabase, Google, Expo). Your use of these services is subject to their respective terms and privacy policies. We are not responsible for third-party service availability or practices.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>8. Disclaimer of Warranties</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that AI-generated wine information will be accurate.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>9. Limitation of Liability</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim (if any).
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>10. Termination</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        You may delete your account at any time by contacting us. We may suspend or terminate your access if you violate these Terms. Upon termination, your right to use the Service ceases immediately.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>11. Changes to These Terms</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms. We will notify you of material changes.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>12. Governing Law</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        These Terms are governed by and construed in accordance with the laws of the State of California, United States, without regard to conflict of law principles.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>13. Contact</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
            Questions about these Terms? Email us at {link("support@appsmithery.co", "mailto:support@appsmithery.co")}.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: PAGE_HORIZONTAL_PADDING, paddingBottom: getScreenBottomPadding(0) },
  h1: { fontSize: 26, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 4 },
  updated: { fontSize: 13, fontFamily: "Montserrat_300Light", marginBottom: 28 },
  h2: { fontSize: 18, fontWeight: "600", fontFamily: "PlayfairDisplay_600SemiBold", marginTop: 24, marginBottom: 10 },
  p: { fontSize: 15, fontFamily: "Montserrat_400Regular", lineHeight: 24, marginBottom: 12 },
  bold: { fontFamily: "Montserrat_600SemiBold" },
  ul: { paddingLeft: 12, marginBottom: 12 },
  li: { fontSize: 15, fontFamily: "Montserrat_400Regular", lineHeight: 24, marginBottom: 8, paddingLeft: 8 },
});
