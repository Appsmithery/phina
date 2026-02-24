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
  const didRecheckForNullSession = useRef(false);

  useEffect(() => {
    if (!sessionLoaded || session) return;
    if (didRecheckForNullSession.current) return;
    didRecheckForNullSession.current = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) setSessionFromAuth(s);
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

  return <Redirect href="/(auth)" />;
}
