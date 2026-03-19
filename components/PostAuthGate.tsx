import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { clearPendingJoinEventId, getPendingJoinEventId, setPendingJoinEventId } from "@/lib/pending-join";
import { resolvePostAuthDestination } from "@/lib/post-auth-route";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent } from "@/lib/observability";
import { getUpdateDiagnostics } from "@/lib/update-diagnostics";
import { supabase } from "@/lib/supabase";

type PostAuthGateProps = {
  source: "index" | "post-auth";
};

const POST_AUTH_SESSION_RECOVERY_DELAY_MS = 400;

export function PostAuthGate({ source }: PostAuthGateProps) {
  const { session, sessionLoaded, member, memberLoaded, setSessionFromAuth } = useSupabase();
  const theme = useTheme();
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [pendingJoinCheckDone, setPendingJoinCheckDone] = useState(false);
  const [sessionRecoveryResolved, setSessionRecoveryResolved] = useState(source !== "post-auth");
  const lastTrackedDestinationRef = useRef<string | null>(null);
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    const canRecoverSession = source === "post-auth";

    if (!canRecoverSession) {
      setSessionRecoveryResolved(true);
      return;
    }

    if (!sessionLoaded) {
      recoveryStartedRef.current = false;
      setSessionRecoveryResolved(false);
      return;
    }

    if (session) {
      setSessionRecoveryResolved(true);
      return;
    }

    if (recoveryStartedRef.current) {
      return;
    }

    recoveryStartedRef.current = true;
    setSessionRecoveryResolved(false);

    const diagnostics = getUpdateDiagnostics();
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    trackEvent("post_auth_session_recovery_started", {
      source,
      update_channel: diagnostics.channel,
      update_id: diagnostics.updateId,
      runtime_version: diagnostics.runtimeVersion,
      embedded_launch: diagnostics.isEmbeddedLaunch,
    });

    const attemptRecovery = async (attempt: 1 | 2) => {
      try {
        const {
          data: { session: recoveredSession },
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (recoveredSession) {
          trackEvent("post_auth_session_recovery_succeeded", {
            source,
            attempt,
            update_channel: diagnostics.channel,
            update_id: diagnostics.updateId,
            runtime_version: diagnostics.runtimeVersion,
            embedded_launch: diagnostics.isEmbeddedLaunch,
          });
          setSessionFromAuth(recoveredSession);
          setSessionRecoveryResolved(true);
          return;
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (__DEV__) {
          console.warn("[post-auth] session recovery attempt failed", {
            attempt,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (attempt === 1) {
        retryTimeout = setTimeout(() => {
          void attemptRecovery(2);
        }, POST_AUTH_SESSION_RECOVERY_DELAY_MS);
        return;
      }

      trackEvent("post_auth_session_recovery_failed", {
        source,
        update_channel: diagnostics.channel,
        update_id: diagnostics.updateId,
        runtime_version: diagnostics.runtimeVersion,
        embedded_launch: diagnostics.isEmbeddedLaunch,
      });
      setSessionRecoveryResolved(true);
    };

    void attemptRecovery(1);

    return () => {
      cancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [session, sessionLoaded, setSessionFromAuth, source]);

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
    if (!sessionLoaded) {
      return null;
    }

    if (source === "post-auth" && !session && !sessionRecoveryResolved) {
      return null;
    }

    if ((session && !memberLoaded) || (session && !pendingJoinCheckDone)) {
      return null;
    }

    return resolvePostAuthDestination({
      session,
      member,
      pendingJoinId,
    });
  }, [member, memberLoaded, pendingJoinCheckDone, pendingJoinId, session, sessionLoaded, sessionRecoveryResolved, source]);

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
