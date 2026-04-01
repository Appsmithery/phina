import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase-context";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { setPendingJoinEventId } from "@/lib/pending-join";
import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";
import { isMobileWebUserAgent } from "@/lib/join-store-links";

export default function JoinEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session, sessionLoaded, member, memberLoaded } = useSupabase();
  const theme = useTheme();
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);
  const [authRedirecting, setAuthRedirecting] = useState(false);
  const [authRedirectError, setAuthRedirectError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const authRedirectStartedRef = useRef(false);
  const webUserAgent =
    Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobileWeb = Platform.OS === "web" && isMobileWebUserAgent(webUserAgent);

  useEffect(() => {
    if (!sessionLoaded || !eventId) return;

    if (!session) {
      if (authRedirectStartedRef.current) {
        return;
      }

      authRedirectStartedRef.current = true;
      setAuthRedirecting(true);
      setAuthRedirectError(null);

      setPendingJoinEventId(eventId)
        .then(() => {
          router.replace("/(auth)");
        })
        .catch(() => {
          authRedirectStartedRef.current = false;
          setAuthRedirecting(false);
          setAuthRedirectError(
            isMobileWeb
              ? "Could not continue to sign in from this invite. Please try again."
              : "Could not join this event right now. Please try again.",
          );
        });
      return;
    }

    authRedirectStartedRef.current = false;
    setAuthRedirecting(false);
    setAuthRedirectError(null);

    if (!memberLoaded) {
      return;
    }

    (async () => {
      setJoining(true);
      try {
        if (!member?.id) {
          throw new Error("Your profile is still being set up. Please finish onboarding and try joining again.");
        }
        const { error } = await supabase.from("event_members").upsert(
          { event_id: eventId, member_id: member.id, checked_in: true },
          { onConflict: "event_id,member_id" }
        );
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["event", eventId] });
        queryClient.invalidateQueries({ queryKey: ["event_members_count", eventId] });
        queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] });
        setDone(true);
        trackEvent("event_joined", {
          event_id: eventId,
          platform: Platform.OS,
          source: "join_link",
        });
        router.replace(`/event/${eventId}`);
      } catch (e: unknown) {
        showAlert(
          "Error",
          e instanceof Error ? e.message : "Could not join event. Please try again."
        );
        setJoining(false);
      }
    })();
  }, [sessionLoaded, session, member, memberLoaded, eventId, queryClient, isMobileWeb]);

  const handleContinueToAuth = async () => {
    if (!eventId) return;

    try {
      setAuthRedirecting(true);
      setAuthRedirectError(null);
      await setPendingJoinEventId(eventId);
      router.replace("/(auth)");
    } catch {
      setAuthRedirecting(false);
      setAuthRedirectError("Could not continue to sign in from this invite. Please try again.");
    }
  };

  if (!sessionLoaded || (session && !memberLoaded) || joining || (!session && authRedirecting)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          {session ? "Joining event..." : isMobileWeb ? "Preparing your invite..." : "Joining event..."}
        </Text>
      </View>
    );
  }

  if (!session && isMobileWeb && authRedirectError) {
    return (
      <View style={[styles.container, styles.storeLanding, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.storeCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.storeEyebrow, { color: theme.primary }]}>Event Invite</Text>
          <Text style={[styles.storeTitle, { color: theme.text }]}>
            Continue to sign in
          </Text>
          <Text style={[styles.storeBody, { color: theme.textSecondary }]}>
            Sign in or create your account to join this event. We will bring you back here after auth.
          </Text>
          <Text style={[styles.storeHint, { color: theme.textMuted }]}>
            {authRedirectError}
          </Text>

          <TouchableOpacity
            style={[styles.primaryStoreButton, { backgroundColor: theme.primary }]}
            onPress={handleContinueToAuth}
          >
            <Text style={styles.primaryStoreButtonText}>
              Continue to sign in
            </Text>
          </TouchableOpacity>

          <Text style={[styles.secondaryHint, { color: theme.textMuted }]}>
            Your invite will stay attached while you finish auth in this browser.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>
        {done ? "You're in!" : "Redirecting..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  storeLanding: { paddingVertical: 40 },
  storeCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
  },
  storeEyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  storeTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 12,
  },
  storeBody: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 12,
  },
  storeHint: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 24,
  },
  primaryStoreButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  primaryStoreButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
  },
  secondaryStoreButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryStoreButtonText: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
  },
  secondaryHint: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
  },
  text: { marginTop: 16, fontSize: 16, fontFamily: "Montserrat_400Regular" },
});
