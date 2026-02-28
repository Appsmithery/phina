import { ScrollView, Text, View, StyleSheet, Linking } from "react-native";
import { useTheme } from "@/lib/theme";

export default function PrivacyScreen() {
  const theme = useTheme();

  const link = (text: string, url: string) => (
    <Text style={{ color: theme.primary }} onPress={() => Linking.openURL(url)}>
      {text}
    </Text>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.h1, { color: theme.text }]}>Privacy Policy</Text>
      <Text style={[styles.updated, { color: theme.textMuted }]}>Last updated: February 28, 2026</Text>

      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Phína ("we", "us", or "our") operates the Phína mobile application and website (the "Service"). This policy describes how we collect, use, and protect your information.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>1. Information We Collect</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Account information.</Text> When you create an account we collect your email address, display name, and authentication credentials. If you sign in with Google, we receive your name, email, and profile photo from Google.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Wine data.</Text> Information you enter about wines — producer, varietal, vintage, region, tasting notes, ratings, and label photos you upload.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Event data.</Text> Events you create or join, your membership and check-in status, and votes you cast during rating rounds.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Device information.</Text> If you enable push notifications, we store your device push token so we can deliver notifications. We do not collect device identifiers for advertising.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Label photos.</Text> Photos you take of wine labels are sent to a third-party AI service for text extraction, then stored in our cloud storage. We do not use label photos for any purpose other than extracting wine information for you.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>2. How We Use Your Information</Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>To provide and maintain the Service — creating events, tracking wines, running rating rounds.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>To send you push notifications you have opted into (e.g., when a rating round starts).</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>To extract wine details from label photos using AI.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>To display anonymized aggregate ratings to event participants.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>To improve the Service and fix bugs.</Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>3. Data Sharing</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We do not sell your personal information. We share data only in these limited cases:
      </Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Within events.</Text> Other members of an event you join can see your display name and the wines you brought. Ratings are anonymous — other members see aggregate scores but not who rated what.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Service providers.</Text> We use Supabase (database and authentication), Expo (push notifications), and third-party AI services (label extraction). These providers process data on our behalf under their own privacy policies.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Legal requirements.</Text> We may disclose information if required by law or to protect our rights.
        </Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>4. Data Storage and Security</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Your data is stored in Supabase (hosted on AWS). We use row-level security policies to ensure users can only access data they are authorized to see. All connections use HTTPS/TLS encryption in transit.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>5. Your Rights</Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Update your display name and preferences in the Profile tab.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Delete wines you have added.</Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>Request deletion of your account and all associated data by contacting us at the email below.</Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>6. Data Retention</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>7. Children</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Phína is intended for users of legal drinking age in their jurisdiction. We do not knowingly collect information from anyone under the age of 21 (or the applicable legal drinking age).
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>8. Changes to This Policy</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We may update this policy from time to time. We will notify you of material changes by posting the new policy in the app or on our website.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>9. Contact</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Questions or requests? Email us at {link("help@appsmithery.co", "mailto:help@appsmithery.co")}.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 80 },
  h1: { fontSize: 26, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 4 },
  updated: { fontSize: 13, fontFamily: "Montserrat_300Light", marginBottom: 28 },
  h2: { fontSize: 18, fontWeight: "600", fontFamily: "PlayfairDisplay_600SemiBold", marginTop: 24, marginBottom: 10 },
  p: { fontSize: 15, fontFamily: "Montserrat_400Regular", lineHeight: 24, marginBottom: 12 },
  bold: { fontFamily: "Montserrat_600SemiBold" },
  ul: { paddingLeft: 12, marginBottom: 12 },
  li: { fontSize: 15, fontFamily: "Montserrat_400Regular", lineHeight: 24, marginBottom: 8, paddingLeft: 8 },
});
