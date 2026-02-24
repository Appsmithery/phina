import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { supabase } from "@/lib/supabase";
import { getPendingJoinEventId, clearPendingJoinEventId } from "@/lib/pending-join";

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  text: { marginTop: 8, fontSize: 16, color: "#666" },
});

export default function Index() {
  const { session, sessionLoaded, member, setSessionFromAuth } = useSupabase();
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [pendingJoinCheckDone, setPendingJoinCheckDone] = useState(false);
  const [nullSessionRecheckDone, setNullSessionRecheckDone] = useState(false);
  const didRecheckForNullSession = useRef(false);

  useEffect(() => {
    if (!sessionLoaded || session) {
      if (session) setNullSessionRecheckDone(true);
      return;
    }
    if (didRecheckForNullSession.current) return;
    didRecheckForNullSession.current = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSessionFromAuth(s);
      setNullSessionRecheckDone(true);
    });
  }, [sessionLoaded, session, setSessionFromAuth]);

  useEffect(() => {
    if (!sessionLoaded || !session) {
      setPendingJoinCheckDone(false);
      return;
    }
    getPendingJoinEventId()
      .then((id) => {
        if (id) {
          setPendingJoinId(id);
          clearPendingJoinEventId();
        }
        setPendingJoinCheckDone(true);
      })
      .catch(() => setPendingJoinCheckDone(true));
  }, [sessionLoaded, session]);

  if (!sessionLoaded) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" />
        <Text style={loadingStyles.text}>Loading…</Text>
      </View>
    );
  }

  // When context says no session, recheck with Supabase once before redirecting to auth
  // (avoids redirecting to auth when we landed here right after sign-in with stale context)
  if (!session && !nullSessionRecheckDone) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" />
        <Text style={loadingStyles.text}>Loading…</Text>
      </View>
    );
  }

  if (session && pendingJoinId) {
    return <Redirect href={`/join/${pendingJoinId}`} />;
  }

  if (session && !pendingJoinCheckDone) {
    return null;
  }

  if (session) {
    if (member && !member.name?.trim()) {
      return <Redirect href="/(tabs)/profile" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  if (__DEV__) {
    console.log("[auth] index redirect to auth", {
      sessionLoaded,
      hasSession: !!session,
      nullSessionRecheckDone,
    });
  }
  return <Redirect href="/(auth)" />;
}
