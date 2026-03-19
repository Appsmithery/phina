import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { clearPendingJoinEventId, getPendingJoinEventId, setPendingJoinEventId } from "@/lib/pending-join";
import { resolvePostAuthDestination } from "@/lib/post-auth-route";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent } from "@/lib/observability";
import { getUpdateDiagnostics } from "@/lib/update-diagnostics";

type PostAuthGateProps = {
  source: "index" | "post-auth";
};

export function PostAuthGate({ source }: PostAuthGateProps) {
  const { session, sessionLoaded, member, memberLoaded } = useSupabase();
  const theme = useTheme();
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [pendingJoinCheckDone, setPendingJoinCheckDone] = useState(false);
  const lastTrackedDestinationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionLoaded || !session || !memberLoaded) {
      setPendingJoinCheckDone(false);
      setPendingJoinId(null);
      return;
    }

    getPendingJoinEventId()
      .then((id) => {
        if (id) {
          setPendingJoinId(id);
          return clearPendingJoinEventId().catch(() => {});
        }
        return undefined;
      })
      .finally(() => {
        setPendingJoinCheckDone(true);
      });
  }, [memberLoaded, session, sessionLoaded]);

  const destination = useMemo(() => {
    if (!sessionLoaded || (session && !memberLoaded) || (session && !pendingJoinCheckDone)) {
      return null;
    }

    return resolvePostAuthDestination({
      session,
      member,
      pendingJoinId,
    });
  }, [member, memberLoaded, pendingJoinCheckDone, pendingJoinId, session, sessionLoaded]);

  useEffect(() => {
    if (!pendingJoinId || destination !== "/onboarding") {
      return;
    }

    setPendingJoinEventId(pendingJoinId).catch(() => {});
  }, [destination, pendingJoinId]);

  useEffect(() => {
    if (!destination || lastTrackedDestinationRef.current === destination) {
      return;
    }

    lastTrackedDestinationRef.current = destination;
    const diagnostics = getUpdateDiagnostics();

    trackEvent("post_auth_destination_resolved", {
      source,
      destination,
      update_channel: diagnostics.channel,
      update_id: diagnostics.updateId,
      runtime_version: diagnostics.runtimeVersion,
      embedded_launch: diagnostics.isEmbeddedLaunch,
    });
  }, [destination, source]);

  if (!destination) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.text, { color: theme.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginTop: 8,
    fontSize: 16,
  },
});
