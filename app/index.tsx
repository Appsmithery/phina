import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { getPendingJoinEventId, clearPendingJoinEventId } from "@/lib/pending-join";

export default function Index() {
  const { session, sessionLoaded, member } = useSupabase();
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [pendingJoinCheckDone, setPendingJoinCheckDone] = useState(false);

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
    return null;
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
