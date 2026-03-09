import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { EventForm, type EventFormValues } from "@/components/EventForm";
import { showAlert } from "@/lib/alert";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Event } from "@/types/database";

interface EditEventPayload {
  event: Event;
  winesCount: number;
  roundsCount: number;
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const deniedRef = useRef(false);

  const userId = member?.id ?? session?.user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["event-edit", id],
    queryFn: async () => {
      const [{ data: event, error: eventError }, { count: winesCount, error: winesError }, { count: roundsCount, error: roundsError }] =
        await Promise.all([
          supabase.from("events").select("*").eq("id", id!).single(),
          supabase.from("wines").select("*", { count: "exact", head: true }).eq("event_id", id!),
          supabase.from("rating_rounds").select("*", { count: "exact", head: true }).eq("event_id", id!),
        ]);

      if (eventError) throw eventError;
      if (winesError) throw winesError;
      if (roundsError) throw roundsError;

      return {
        event: event as Event,
        winesCount: winesCount ?? 0,
        roundsCount: roundsCount ?? 0,
      } satisfies EditEventPayload;
    },
    enabled: !!id && !!userId,
  });

  useEffect(() => {
    if (!data?.event || !id || deniedRef.current) return;
    if (data.event.created_by === userId) return;

    deniedRef.current = true;
    showAlert("Host only", "Only the event host can edit event details.", [
      {
        text: "OK",
        onPress: () => router.replace(`/event/${id}`),
      },
    ]);
  }, [data?.event, id, userId]);

  const save = async (values: EventFormValues) => {
    if (!id || !data?.event || data.event.created_by !== userId) return;

    setIsSaving(true);
    try {
      const updates: Partial<Pick<Event, "title" | "theme" | "description" | "partiful_url" | "date" | "tasting_mode">> = {
        title: values.title,
        theme: values.theme,
        description: values.description,
        partiful_url: values.partifulUrl,
        date: values.date,
        tasting_mode: values.tastingMode,
      };

      const { error } = await supabase.from("events").update(updates).eq("id", id);
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", id] }),
        queryClient.invalidateQueries({ queryKey: ["event-edit", id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);

      router.replace(`/event/${id}`);
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "Could not update event");
    } finally {
      setIsSaving(false);
    }
  };

  if (!id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Sign in to edit this event.</Text>
      </View>
    );
  }

  if (isLoading || !data?.event) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (data.event.created_by !== userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Redirecting...</Text>
      </View>
    );
  }

  const tastingModeLocked = data.winesCount > 0 || data.roundsCount > 0;

  return (
    <EventForm
      heading="Edit event"
      submitLabel="Save changes"
      isSubmitting={isSaving}
      initialValues={{
        title: data.event.title,
        theme: data.event.theme,
        description: data.event.description ?? "",
        partifulUrl: data.event.partiful_url ?? "",
        date: data.event.date,
        tastingMode: data.event.tasting_mode,
      }}
      tastingModeLocked={tastingModeLocked}
      tastingModeLockedReason="Tasting mode is locked once wines or rating rounds exist for the event."
      onSubmit={save}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: { padding: 24, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
