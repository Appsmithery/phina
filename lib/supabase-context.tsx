import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { registerPushTokenIfNeeded } from "./push-registration";
import { identifyUser, clearUser, trackEvent } from "./observability";
import type { Member } from "@/types/database";
import { extractGoogleAvatarUrl, shouldSeedGoogleAvatar } from "./avatar";
import { configureRevenueCatForMember, resetRevenueCatUser } from "./billing";

type SupabaseContextType = {
  session: Session | null;
  member: Member | null;
  sessionLoaded: boolean;
  refreshMember: () => Promise<void>;
  /** Call after sign-in/sign-up so the app sees the new session before navigation. */
  setSessionFromAuth: (session: Session | null) => void;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const fetchMember = async (user: User) => {
    const { data } = await supabase.from("members").select("*").eq("id", user.id).single();
    if (data) {
      let nextMember: Member = data;
      const googleAvatarUrl = extractGoogleAvatarUrl(user);

      if (googleAvatarUrl && shouldSeedGoogleAvatar(data)) {
        const { data: updated } = await supabase
          .from("members")
          .update({ avatar_url: googleAvatarUrl, avatar_source: "google" })
          .eq("id", user.id)
          .select("*")
          .single();
        nextMember = updated ?? { ...data, avatar_url: googleAvatarUrl, avatar_source: "google" };
      }

      setMember(nextMember);
      identifyUser(user.id);
      configureRevenueCatForMember(user.id, user.email).catch(() => {});
      registerPushTokenIfNeeded(user.id).catch(() => {});
      return;
    }

    if (user.email) {
      const googleAvatarUrl = extractGoogleAvatarUrl(user);
      await supabase.from("members").upsert(
        {
          id: user.id,
          email: user.email,
          ...(googleAvatarUrl ? { avatar_url: googleAvatarUrl, avatar_source: "google" as const } : {}),
        },
        { onConflict: "id" }
      );
      const { data: created } = await supabase.from("members").select("*").eq("id", user.id).single();
      setMember(created ?? null);
      identifyUser(user.id);
      trackEvent("user_signed_up");
      configureRevenueCatForMember(user.id, user.email).catch(() => {});
      registerPushTokenIfNeeded(user.id).catch(() => {});
    } else {
      setMember(null);
    }
  };

  const refreshMember = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) await fetchMember(s.user);
  }, []);

  const setSessionFromAuth = useCallback((s: Session | null) => {
    setSession(s);
    setSessionLoaded(true);
    if (s?.user) {
      fetchMember(s.user);
    } else {
      setMember(null);
      resetRevenueCatUser().catch(() => {});
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user) fetchMember(s.user).finally(() => setSessionLoaded(true));
        else setSessionLoaded(true);
      })
      .catch(() => setSessionLoaded(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) fetchMember(s.user);
      else {
        setMember(null);
        clearUser();
        resetRevenueCatUser().catch(() => {});
      }
      setSessionLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s);
          if (s?.user) fetchMember(s.user);
          else {
            setMember(null);
            resetRevenueCatUser().catch(() => {});
          }
        });
        // Refresh all stale queries when app resumes from background
        queryClient.invalidateQueries();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [queryClient]);

  return (
    <SupabaseContext.Provider value={{ session, member, sessionLoaded, refreshMember, setSessionFromAuth }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (ctx === undefined) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}
