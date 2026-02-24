import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Member } from "@/types/database";

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
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const fetchMember = async (userId: string, email?: string) => {
    const { data } = await supabase.from("members").select("*").eq("id", userId).single();
    if (data) {
      setMember(data);
      return;
    }
    if (email) {
      await supabase.from("members").upsert({ id: userId, email }, { onConflict: "id" });
      const { data: created } = await supabase.from("members").select("*").eq("id", userId).single();
      setMember(created ?? null);
    } else {
      setMember(null);
    }
  };

  const refreshMember = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user?.id) await fetchMember(s.user.id, s.user.email ?? undefined);
  };

  const setSessionFromAuth = (s: Session | null) => {
    setSession(s);
    if (s?.user?.id) {
      fetchMember(s.user.id, s.user.email ?? undefined).finally(() => setSessionLoaded(true));
    } else {
      setMember(null);
      setSessionLoaded(true);
    }
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user?.id) fetchMember(s.user.id, s.user.email ?? undefined).finally(() => setSessionLoaded(true));
        else setSessionLoaded(true);
      })
      .catch(() => setSessionLoaded(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) fetchMember(s.user.id, s.user.email ?? undefined);
      else setMember(null);
      setSessionLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

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
