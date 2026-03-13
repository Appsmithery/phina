import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
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
  memberLoaded: boolean;
  refreshMember: () => Promise<void>;
  /** Call after sign-in/sign-up so the app sees the new session before navigation. */
  setSessionFromAuth: (session: Session | null) => void;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

function logAuthTransition(message: string, data?: Record<string, unknown>) {
  if (__DEV__) {
    console.log("[auth]", message, data ?? {});
  }
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [memberLoaded, setMemberLoaded] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const resumeRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMember = async (user: User) => {
    setMemberLoaded(false);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
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
        const { data: created, error: upsertError } = await supabase
          .from("members")
          .upsert(
            {
              id: user.id,
              email: user.email,
              ...(googleAvatarUrl ? { avatar_url: googleAvatarUrl, avatar_source: "google" as const } : {}),
            },
            { onConflict: "id" }
          )
          .select("*")
          .single();
        if (upsertError) throw upsertError;
        setMember(created);
        identifyUser(user.id);
        trackEvent("user_signed_up", { platform: Platform.OS, source: "member_bootstrap" });
        configureRevenueCatForMember(user.id, user.email).catch(() => {});
        registerPushTokenIfNeeded(user.id).catch(() => {});
      } else {
        setMember(null);
      }
    } finally {
      setMemberLoaded(true);
    }
  };

  const refreshMember = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    logAuthTransition("refreshMember getSession resolved", {
      hasSession: !!s,
      userId: s?.user?.id ?? null,
    });
    if (s?.user) {
      await fetchMember(s.user);
    } else {
      setMember(null);
      setMemberLoaded(true);
    }
  }, []);

  const setSessionFromAuth = useCallback((s: Session | null) => {
    logAuthTransition("setSessionFromAuth called", {
      hasSession: !!s,
      userId: s?.user?.id ?? null,
    });
    sessionRef.current = s;
    setSession(s);
    setSessionLoaded(true);
    if (s?.user) {
      setMemberLoaded(false);
      fetchMember(s.user).catch(() => {
        setMember(null);
        setMemberLoaded(true);
      });
    } else {
      setMember(null);
      setMemberLoaded(true);
      resetRevenueCatUser().catch(() => {});
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        logAuthTransition("initial getSession resolved", {
          hasSession: !!s,
          userId: s?.user?.id ?? null,
        });
        sessionRef.current = s;
        setSession(s);
        if (s?.user) {
          setMemberLoaded(false);
          fetchMember(s.user)
            .catch(() => {
              setMember(null);
              setMemberLoaded(true);
            })
            .finally(() => setSessionLoaded(true));
        } else {
          setMemberLoaded(true);
          setSessionLoaded(true);
        }
      })
      .catch((error) => {
        logAuthTransition("initial getSession failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        setMemberLoaded(true);
        setSessionLoaded(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      logAuthTransition("onAuthStateChange", {
        event,
        hasSession: !!s,
        userId: s?.user?.id ?? null,
      });
      sessionRef.current = s;
      setSession(s);
      if (s?.user) {
        setMemberLoaded(false);
        fetchMember(s.user).catch(() => {
          setMember(null);
          setMemberLoaded(true);
        });
      }
      else {
        setMember(null);
        setMemberLoaded(true);
        clearUser();
        resetRevenueCatUser().catch(() => {});
      }
      setSessionLoaded(true);
    });

    return () => {
      if (resumeRetryTimeoutRef.current) {
        clearTimeout(resumeRetryTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      logAuthTransition("AppState change", {
        nextState,
        hasLocalSession: !!sessionRef.current,
        userId: sessionRef.current?.user?.id ?? null,
      });
      if (nextState === "active") {
        const resolveForegroundSession = (attempt: "initial" | "retry") => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            logAuthTransition(`AppState active -> getSession (${attempt}) resolved`, {
              hasSession: !!s,
              userId: s?.user?.id ?? null,
              hadLocalSession: !!sessionRef.current,
            });

            if (s?.user) {
              sessionRef.current = s;
              setSession(s);
              setMemberLoaded(false);
              fetchMember(s.user).catch(() => {
                setMember(null);
                setMemberLoaded(true);
              });
              return;
            }

            if (attempt === "initial" && sessionRef.current) {
              logAuthTransition("AppState active preserving in-memory session before retry", {
                userId: sessionRef.current.user?.id ?? null,
              });
              if (resumeRetryTimeoutRef.current) {
                clearTimeout(resumeRetryTimeoutRef.current);
              }
              resumeRetryTimeoutRef.current = setTimeout(() => {
                resolveForegroundSession("retry");
              }, 400);
              return;
            }

            sessionRef.current = null;
            setSession(null);
            setMember(null);
            setMemberLoaded(true);
            resetRevenueCatUser().catch(() => {});
          }).catch((error) => {
            logAuthTransition(`AppState active -> getSession (${attempt}) failed`, {
              message: error instanceof Error ? error.message : String(error),
            });
            if (attempt === "retry" && !sessionRef.current) {
              setSession(null);
              setMember(null);
              setMemberLoaded(true);
              resetRevenueCatUser().catch(() => {});
            }
          });
        };

        if (resumeRetryTimeoutRef.current) {
          clearTimeout(resumeRetryTimeoutRef.current);
          resumeRetryTimeoutRef.current = null;
        }

        resolveForegroundSession("initial");
        // Refresh all stale queries when app resumes from background
        queryClient.invalidateQueries();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      if (resumeRetryTimeoutRef.current) {
        clearTimeout(resumeRetryTimeoutRef.current);
        resumeRetryTimeoutRef.current = null;
      }
      sub.remove();
    };
  }, [queryClient]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (__DEV__) {
      logAuthTransition("context state updated", {
        sessionLoaded,
        memberLoaded,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        hasMember: !!member,
      });
    }
  }, [sessionLoaded, memberLoaded, session, member]);

  return (
    <SupabaseContext.Provider value={{ session, member, sessionLoaded, memberLoaded, refreshMember, setSessionFromAuth }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (ctx === undefined) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}
