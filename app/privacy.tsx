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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.h1, { color: theme.text }]}>Privacy Policy</Text>
      <Text style={[styles.updated, { color: theme.textMuted }]}>
        Last updated: March 10, 2026
      </Text>

      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Phina ("we", "us", or "our") operates the Phina mobile application and website
        (the "Service"). This policy describes how we collect, use, and protect your
        information.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>1. Information We Collect</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Account information.</Text> When you create an account,
        we collect your email address, first name, last name, date of birth, and
        authentication credentials. We collect your date of birth to verify that you are
        of legal drinking age. If you sign in with Google or Sign in with Apple, we may
        receive identity details made available by that provider, such as your name,
        email address, and profile photo when provided.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Wine and event data.</Text> We collect information you
        enter about wines and events, including producer, varietal, vintage, region,
        tasting notes, ratings, event membership, and check-in status.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Profile information.</Text> You may optionally provide
        your phone number, city, state, zip code, wine experience level, and avatar or
        profile photo. This information helps us operate the Service and personalize your
        experience. Your phone number and location details are not shared with other
        users.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Photos.</Text> Photos you take or upload for wine label
        scanning are sent to a third-party AI service for text extraction and are stored
        in our cloud storage. If you upload an avatar or profile photo, that photo is
        also stored by us.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Device and app identifiers.</Text> If you enable push
        notifications, we store your device push token so we can deliver notifications.
        We also use internal account or member identifiers to operate the Service and to
        associate analytics and crash reports with your account.
      </Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        <Text style={styles.bold}>Usage and diagnostics.</Text> We collect product
        interaction data, such as key actions taken in the app, and crash data through
        service providers including PostHog and Sentry. These records may be associated
        with your internal account identifier so we can understand usage, investigate
        issues, and improve the Service.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>2. How We Use Your Information</Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To provide and maintain the Service, including creating events, tracking wines,
          running rating rounds, and managing your account.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To send you push notifications you have opted into, such as when a rating round
          starts.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To extract wine details from label photos using AI.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To verify you are of legal drinking age.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To display anonymized aggregate ratings to event participants.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          To improve the Service, analyze product usage, and fix bugs.
        </Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>3. Data Sharing</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We do not sell your personal information. We do not use your data for third-party
        advertising, advertising measurement, or data broker sharing. We share data only
        in these limited cases:
      </Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Within events.</Text> Other members of an event you
          join can see your display name and the wines you brought. Your birthday, phone
          number, and location details are not visible to other users. Ratings are
          anonymous to other members, who see aggregate scores but not who rated what.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Service providers.</Text> We use Supabase (database
          and authentication), Expo (push notifications), third-party AI services (label
          extraction), Sentry (error monitoring), and PostHog (product analytics). These
          providers process data on our behalf under their own privacy policies. Product
          analytics and crash reports may be associated with your internal account
          identifier so we can understand usage and investigate issues.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          <Text style={styles.bold}>Legal requirements.</Text> We may disclose information
          if required by law or to protect our rights.
        </Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>4. Data Storage and Security</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Your data is stored in Supabase (hosted on AWS). We use row-level security
        policies to ensure users can only access data they are authorized to see. All
        connections use HTTPS/TLS encryption in transit.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>5. Your Rights</Text>
      <View style={styles.ul}>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          Update your name, phone number, location details, wine experience level, and
          avatar in the app.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          Delete wines you have added.
        </Text>
        <Text style={[styles.li, { color: theme.textSecondary }]}>
          Request deletion of your account and associated personal data by contacting us
          at the email below.
        </Text>
      </View>

      <Text style={[styles.h2, { color: theme.text }]}>6. Data Retention</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We retain your data for as long as your account is active. If you delete your
        account, we will remove your personal data within 30 days, except where
        retention is required by law.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>7. Children</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Phina is intended for users of legal drinking age in their jurisdiction. We do
        not knowingly collect information from anyone under the age of 21, or the
        applicable legal drinking age in their jurisdiction.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>8. Changes to This Policy</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        We may update this policy from time to time. We will notify you of material
        changes by posting the new policy in the app or on our website.
      </Text>

      <Text style={[styles.h2, { color: theme.text }]}>9. Contact</Text>
      <Text style={[styles.p, { color: theme.textSecondary }]}>
        Questions or requests? Email us at{" "}
        {link("help@appsmithery.co", "mailto:help@appsmithery.co")}.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 80 },
  h1: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 4,
  },
  updated: { fontSize: 13, fontFamily: "Montserrat_300Light", marginBottom: 28 },
  h2: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "PlayfairDisplay_600SemiBold",
    marginTop: 24,
    marginBottom: 10,
  },
  p: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
    lineHeight: 24,
    marginBottom: 12,
  },
  bold: { fontFamily: "Montserrat_600SemiBold" },
  ul: { paddingLeft: 12, marginBottom: 12 },
  li: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
    lineHeight: 24,
    marginBottom: 8,
    paddingLeft: 8,
  },
});
