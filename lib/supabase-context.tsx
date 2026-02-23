import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Member } from "@/types/database";

type SupabaseContextType = {
  session: Session | null;
  member: Member | null;
  sessionLoaded: boolean;
  refreshMember: () => Promise<void>;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const fetchMember = async (userId: string) => {
    const { data } = await supabase.from("members").select("*").eq("id", userId).single();
    setMember(data ?? null);
  };

  const refreshMember = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user?.id) await fetchMember(s.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) fetchMember(s.user.id).finally(() => setSessionLoaded(true));
      else setSessionLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) fetchMember(s.user.id);
      else setMember(null);
      setSessionLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SupabaseContext.Provider value={{ session, member, sessionLoaded, refreshMember }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (ctx === undefined) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}
