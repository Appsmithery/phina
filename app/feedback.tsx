import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { PAGE_HORIZONTAL_PADDING, getScreenBottomPadding } from "@/lib/layout";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SENTIMENTS,
  buildFeedbackContext,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@/lib/feedback";
import { trackEvent } from "@/lib/observability";
import { showAlert } from "@/lib/alert";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

export default function FeedbackScreen() {
  const params = useLocalSearchParams<{
    source?: string;
    screen?: string;
    eventId?: string;
    wineId?: string;
    category?: string;
    reportTarget?: string;
    reportTargetId?: string;
    reportedMemberId?: string;
  }>();
  const { member, session } = useSupabase();
  const theme = useTheme();
  const initialCategory = useMemo(() => {
    const requestedCategory = typeof params.category === "string" ? params.category : null;
    if (!requestedCategory) return null;
    return FEEDBACK_CATEGORIES.some((option) => option.value === requestedCategory)
      ? (requestedCategory as FeedbackCategory)
      : null;
  }, [params.category]);
  const [category, setCategory] = useState<FeedbackCategory | null>(initialCategory);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [message, setMessage] = useState("");
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const feedbackSource =
    typeof params.source === "string" && params.source.length > 0
      ? params.source
      : "feedback_screen";
  const previousScreen =
    typeof params.screen === "string" && params.screen.length > 0
      ? params.screen
      : "unknown";
  const eventId = typeof params.eventId === "string" ? params.eventId : null;
  const wineId = typeof params.wineId === "string" ? params.wineId : null;
  const reportTarget =
    typeof params.reportTarget === "string" && params.reportTarget.length > 0
      ? params.reportTarget
      : null;
  const reportTargetId =
    typeof params.reportTargetId === "string" && params.reportTargetId.length > 0
      ? params.reportTargetId
      : null;
  const reportedMemberId =
    typeof params.reportedMemberId === "string" && params.reportedMemberId.length > 0
      ? params.reportedMemberId
      : null;
  const isReportFlow =
    initialCategory === "report_user_content" || initialCategory === "report_ai_content";

  const contextJson = useMemo(
    () =>
      buildFeedbackContext({
        source: feedbackSource,
        previousScreen,
        eventId,
        wineId,
        reportTarget,
        reportTargetId,
        reportedMemberId,
      }),
    [
      eventId,
      feedbackSource,
      previousScreen,
      reportTarget,
      reportTargetId,
      reportedMemberId,
      wineId,
    ]
  );

  useEffect(() => {
    trackEvent("feedback_entry_opened", {
      source: feedbackSource,
      screen: previousScreen,
      event_id: eventId,
      wine_id: wineId,
    });

    return () => {
      if (submittedRef.current) return;
      trackEvent("feedback_dismissed", {
        source: feedbackSource,
        screen: previousScreen,
        event_id: eventId,
        wine_id: wineId,
      });
    };
  }, [eventId, feedbackSource, previousScreen, wineId]);

  const handleSubmit = async () => {
    const memberId = session?.user?.id ?? member?.id;
    const trimmedMessage = message.trim();

    if (!memberId) {
      showAlert("Sign in required", "You need to be signed in to send feedback.");
      return;
    }

    if (!category) {
      showAlert("Category required", "Choose the type of feedback you want to share.");
      return;
    }

    if (!trimmedMessage) {
      showAlert("Details required", "Add a few details so we can understand your feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        memberId,
        category,
        message: trimmedMessage,
        sentiment,
        source: feedbackSource,
        screen: previousScreen,
        wantsFollowUp,
        contextJson,
      });

      submittedRef.current = true;
      trackEvent("feedback_submitted", {
        source: feedbackSource,
        screen: previousScreen,
        category,
        sentiment: sentiment ?? null,
        wants_follow_up: wantsFollowUp,
        event_id: eventId,
        wine_id: wineId,
      });

      if (wantsFollowUp) {
        trackEvent("feedback_follow_up_requested", {
          source: feedbackSource,
          screen: previousScreen,
          category,
          event_id: eventId,
          wine_id: wineId,
        });
      }

      showAlert("Thanks for the feedback", "Your note has been sent.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      showAlert(
        "Could not send feedback",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: isReportFlow ? "Report Content" : "Feedback" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {isReportFlow ? "Report content" : "Share feedback"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isReportFlow
            ? "Tell us what looks wrong, unsafe, or misleading. We will review the report."
            : "Tell us what is working, what is confusing, or what you want next."}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Category</Text>
          <View style={styles.optionWrap}>
            {FEEDBACK_CATEGORIES.map((option) => {
              const selected = category === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    { borderColor: theme.border, backgroundColor: theme.background },
                    selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
                  ]}
                  onPress={() => setCategory(option.value)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: selected ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>How was your experience?</Text>
          <View style={styles.sentimentRow}>
            {FEEDBACK_SENTIMENTS.map((option) => {
              const selected = sentiment === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sentimentPill,
                    { borderColor: theme.border, backgroundColor: theme.background },
                    selected && { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
                  ]}
                  onPress={() => setSentiment((current) => (current === option.value ? null : option.value))}
                >
                  <Text
                    style={[
                      styles.sentimentText,
                      { color: selected ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.text }]}>Details</Text>
          <TextInput
            style={[
              styles.messageInput,
              { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
            ]}
            placeholder={
              isReportFlow
                ? "What should we review? Include anything misleading, unsafe, or inappropriate."
                : "What happened, what felt off, or what would make the app better?"
            }
            placeholderTextColor={theme.textMuted}
            multiline
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={[styles.helperText, { color: theme.textMuted }]}>
            {isReportFlow
              ? "We also capture app version, platform, the screen, and the reported content context."
              : "We also capture app version, platform, and the screen where you opened feedback."}
          </Text>

          <TouchableOpacity
            style={[
              styles.followUpRow,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
            onPress={() => setWantsFollowUp((current) => !current)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: wantsFollowUp ? theme.primary : theme.border, backgroundColor: wantsFollowUp ? theme.primary : "transparent" },
              ]}
            />
            <Text style={[styles.followUpText, { color: theme.text }]}>
              I am open to follow-up about this feedback
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: theme.primary },
              submitting && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Sending..." : isReportFlow ? "Send report" : "Send feedback"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Prefer email?{" "}
            <Text
              style={[styles.footerLink, { color: theme.primary }]}
                  onPress={() => Linking.openURL("mailto:support@appsmithery.co")}
            >
                  support@appsmithery.co
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingBottom: getScreenBottomPadding(0),
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 10,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },
  sentimentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  sentimentPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  sentimentText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 160,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 10,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 14,
  },
  followUpRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  followUpText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
  },
  footerLink: {
    fontFamily: "Montserrat_600SemiBold",
  },
});
