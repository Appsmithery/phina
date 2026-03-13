import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { getPendingJoinEventId, clearPendingJoinEventId, setPendingJoinEventId } from "@/lib/pending-join";

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  text: { marginTop: 8, fontSize: 16, color: "#666" },
});

export default function Index() {
  const { session, sessionLoaded, member, memberLoaded } = useSupabase();
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [pendingJoinCheckDone, setPendingJoinCheckDone] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log("[auth] index state", {
        sessionLoaded,
        memberLoaded,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        hasMember: !!member,
        pendingJoinCheckDone,
        pendingJoinId,
      });
    }
  }, [sessionLoaded, memberLoaded, session, member, pendingJoinCheckDone, pendingJoinId]);

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
          clearPendingJoinEventId();
        }
        setPendingJoinCheckDone(true);
      })
      .catch(() => setPendingJoinCheckDone(true));
  }, [sessionLoaded, session, memberLoaded]);

  if (!sessionLoaded || (session && !memberLoaded)) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" />
        <Text style={loadingStyles.text}>Loading...</Text>
      </View>
    );
  }

  if (session && !pendingJoinCheckDone) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" />
        <Text style={loadingStyles.text}>Loading...</Text>
      </View>
    );
  }

  if (session && member && !member.profile_complete) {
    if (pendingJoinId) {
      setPendingJoinEventId(pendingJoinId);
    }
    return <Redirect href="/onboarding" />;
  }

  if (session && pendingJoinId) {
    return <Redirect href={`/join/${pendingJoinId}`} />;
  }

  if (session) {
    if (__DEV__) {
      console.log("[auth] index redirect to tabs", {
        userId: session.user.id,
      });
    }
    return <Redirect href="/(tabs)" />;
  }

  if (__DEV__) {
    console.log("[auth] index redirect to auth", {
      sessionLoaded,
      memberLoaded,
      hasSession: !!session,
      pendingJoinCheckDone,
    });
  }

  return <Redirect href="/(auth)" />;
}
