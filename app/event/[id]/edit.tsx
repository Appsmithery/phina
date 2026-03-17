import { useEffect, useRef, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { EventForm, type EventFormValues } from "@/components/EventForm";
import { showAlert } from "@/lib/alert";
import {
  extractTimeValue,
  formatEventTime,
} from "@/lib/event-scheduling";
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
      const [
        { data: event, error: eventError },
        { count: winesCount, error: winesError },
        { count: roundsCount, error: roundsError },
      ] = await Promise.all([
        supabase.from("events").select("*").eq("id", id!).single(),
        supabase
          .from("wines")
          .select("*", { count: "exact", head: true })
          .eq("event_id", id!),
        supabase
          .from("rating_rounds")
          .select("*", { count: "exact", head: true })
          .eq("event_id", id!),
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
      const updates: Partial<
        Pick<
          Event,
          | "title"
          | "theme"
          | "description"
          | "web_link"
          | "date"
          | "starts_at"
          | "ends_at"
          | "timezone"
          | "default_rating_window_minutes"
          | "tasting_mode"
          | "event_image_url"
          | "event_image_status"
          | "event_image_source"
        >
      > = {
        title: values.title,
        theme: values.theme,
        description: values.description,
        web_link: values.webLink,
        date: values.date,
        starts_at: values.startsAt,
        ends_at: values.endsAt,
        timezone: values.timezone,
        default_rating_window_minutes: values.defaultRatingWindowMinutes,
        tasting_mode: values.tastingMode,
        event_image_url: values.heroImageUrl,
        event_image_status: values.heroImageStatus,
        event_image_source: values.heroImageUrl ? "uploaded" : "none",
      };

      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", id] }),
        queryClient.invalidateQueries({ queryKey: ["event-edit", id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);

      showAlert(
        "Event updated",
        `This event will end automatically at ${formatEventTime(values.endsAt, values.timezone)} and rating rounds will close after ${values.defaultRatingWindowMinutes} minutes.`,
        [{ text: "OK", onPress: () => router.replace(`/event/${id}`) }],
      );
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "Could not update event",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Event" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Event" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Event" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Sign in to edit this event.
        </Text>
      </View>
    );
  }

  if (isLoading || !data?.event) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Event" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (data.event.created_by !== userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Edit Event" }} />
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Redirecting...
        </Text>
      </View>
    );
  }

  const tastingModeLocked = data.winesCount > 0 || data.roundsCount > 0;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Event" }} />
      <EventForm
        heading="Edit event"
        showHeading={false}
        submitLabel="Save changes"
        memberId={userId}
        isSubmitting={isSaving}
        initialValues={{
          title: data.event.title,
          theme: data.event.theme,
          description: data.event.description ?? "",
          webLink: data.event.web_link ?? "",
          date: data.event.date,
          startTime: extractTimeValue(data.event.starts_at),
          endTime: extractTimeValue(data.event.ends_at),
          ratingWindowMinutes: data.event.default_rating_window_minutes,
          tastingMode: data.event.tasting_mode,
          heroImageUrl: data.event.event_image_url ?? null,
          heroImageStatus: data.event.event_image_status,
        }}
        tastingModeLocked={tastingModeLocked}
        tastingModeLockedReason="Tasting mode is locked once wines or rating rounds exist for the event."
        onSubmit={save}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: {
    padding: 24,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
});
