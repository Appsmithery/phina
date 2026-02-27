import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Share, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { useStartRatingRound, useEndRatingRound, useEndEvent } from "@/hooks/use-event-actions";
import type { Event } from "@/types/database";
import type { WineWithPricePrivacy } from "@/types/database";
import type { RatingRound } from "@/types/database";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const isAuthenticated = sessionLoaded && !!session;

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id && isAuthenticated,
  });

  const { data: wines = [] } = useQuery({
    queryKey: ["wines", id, session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines_with_price_privacy").select("*").eq("event_id", id!).order("created_at", { ascending: true });
      if (error) throw error;
      return data as WineWithPricePrivacy[];
    },
    enabled: !!id && isAuthenticated,
  });

  const { data: rounds = [] } = useQuery({
    queryKey: ["rating_rounds", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rating_rounds").select("*").eq("event_id", id!);
      if (error) throw error;
      return data as RatingRound[];
    },
    enabled: !!id && isAuthenticated && !!event,
  });

  const { data: ratingSummaries = [] } = useQuery({
    queryKey: ["event_rating_summary", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_wine_ratings", { p_event_id: id! });
      if (error) throw error;
      return (data ?? []) as { wine_id: string; thumbs_up: number; meh: number; thumbs_down: number }[];
    },
    enabled: !!id && isAuthenticated && event?.status === "ended",
  });

  const userId = session?.user?.id ?? member?.id;
  const { data: eventFavorite } = useQuery({
    queryKey: ["event_favorite", id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_favorites")
        .select("wine_id")
        .eq("event_id", id!)
        .eq("member_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { wine_id: string } | null;
    },
    enabled: !!id && !!userId && isAuthenticated,
  });

  const isHost = event?.created_by === member?.id;
  const endEventMutation = useEndEvent(id!);

  const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

  const handleShareInvite = async () => {
    const joinUrl = `${APP_BASE_URL}/join/${id}`;
    const message = `Join my wine tasting event: ${joinUrl}`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { url: joinUrl, message: `Join my wine tasting event` }
          : { message }
      );
    } catch {
      // user cancelled or share failed silently
    }
  };

  const canDeleteEvent = isHost || member?.is_admin;

  const handleDeleteEvent = () => {
    Alert.alert(
      "Delete event?",
      "This will permanently delete the event and all wines, ratings, and member data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("events").delete().eq("id", id!);
            if (error) {
              Alert.alert("Error", error.message ?? "Could not delete event.");
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["events"] });
            router.replace("/(tabs)");
          },
        },
      ]
    );
  };

  const handleRemoveWine = (wine: WineWithPricePrivacy) => {
    Alert.alert(
      "Remove wine",
      "Remove this wine from the event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("wines").delete().eq("id", wine.id);
            if (error) {
              Alert.alert("Error", error.message ?? "Could not remove wine.");
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["wines", id] });
          },
        },
      ]
    );
  };

  if (!id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  if (sessionLoaded && !session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Sign in to view this event.</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => router.replace("/(auth)/sign-in")}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || !event) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {event.theme} · {new Date(event.date).toLocaleDateString()} · {event.status}
      </Text>

      {isHost && (
        <>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push(`/event/${id}/qr`)}
          >
            <Text style={styles.primaryButtonText}>Show QR code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareButton, { borderColor: theme.primary }]}
            onPress={handleShareInvite}
          >
            <Ionicons name="share-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.shareButtonText, { color: theme.primary }]}>Share invite link</Text>
          </TouchableOpacity>
          {event.status === "active" && (
            <TouchableOpacity
              style={[styles.endEventButton, { borderColor: theme.textMuted }]}
              onPress={() =>
                Alert.alert("End event?", "Results will be revealed to everyone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "End event", style: "destructive", onPress: () => endEventMutation.mutate() },
                ])
              }
              disabled={endEventMutation.isPending}
            >
              <Text style={[styles.endEventText, { color: theme.textMuted }]}>End event</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {canDeleteEvent && (
        <TouchableOpacity
          style={[styles.deleteEventButton, { borderColor: "#B55A5A" }]}
          onPress={handleDeleteEvent}
        >
          <Text style={[styles.deleteEventText, { color: "#B55A5A" }]}>Delete event</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
          style={[styles.addWineButton, { borderColor: theme.primary }]}
          onPress={() => router.push(`/event/${id}/add-wine`)}
        >
          <Text style={[styles.addWineText, { color: theme.primary }]}>+ Add wine</Text>
        </TouchableOpacity>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Wines</Text>
      {wines.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>No wines yet.</Text>
      ) : (
        <FlatList
          data={wines}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const activeRound = rounds.find((r) => r.wine_id === item.id && r.is_active);
            const round = activeRound ?? rounds.find((r) => r.wine_id === item.id);
            const summary = ratingSummaries.find((s) => s.wine_id === item.id);
            const canRemove = isHost || item.brought_by === member?.id;
            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.push(`/event/${id}/wine/${item.id}`)}>
                  <View style={styles.wineNameRow}>
                    <Text style={[styles.wineName, { color: theme.text }]}>
                      {item.quantity != null && item.quantity > 1 ? `${item.quantity}× ` : ""}
                      {item.producer ?? "Unknown"} {item.varietal ?? ""} {item.vintage ?? ""}
                    </Text>
                    {eventFavorite?.wine_id === item.id && (
                      <Ionicons name="star" size={18} color={theme.primary} style={styles.favoriteStar} />
                    )}
                  </View>
                  {item.region && (
                    <Text style={[styles.wineMeta, { color: theme.textSecondary }]}>{item.region}</Text>
                  )}
                  {(item.price_cents != null || item.price_range != null) && (
                    <Text style={[styles.wineMeta, { color: theme.textSecondary }]}>
                      {item.price_cents != null ? `$${item.price_cents / 100}` : item.price_range ?? ""}
                    </Text>
                  )}
                </TouchableOpacity>
                {event.status === "ended" && summary && (
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultText, { color: theme.text }]}>
                      👍 {summary.thumbs_up}  😐 {summary.meh}  👎 {summary.thumbs_down}
                    </Text>
                  </View>
                )}
                {event.status === "active" && isHost && (
                  <WineHostActions
                    eventId={id!}
                    wine={item}
                    round={activeRound ?? round}
                    theme={theme}
                    onRate={() => router.push(`/event/${id}/rate/${item.id}`)}
                  />
                )}
                {event.status === "active" && !isHost && activeRound && (
                  <TouchableOpacity
                    style={[styles.rateButton, { backgroundColor: theme.secondary }]}
                    onPress={() => router.push(`/event/${id}/rate/${item.id}`)}
                  >
                    <Text style={styles.rateButtonText}>Rate</Text>
                  </TouchableOpacity>
                )}
                {event.status === "active" && !isHost && !activeRound && member?.is_admin && (
                  <WineAdminReopen eventId={id!} wineId={item.id} theme={theme} />
                )}
                {canRemove && (
                  <TouchableOpacity
                    style={[styles.removeButton, { borderColor: theme.textMuted }]}
                    onPress={() => handleRemoveWine(item)}
                  >
                    <Text style={[styles.removeButtonText, { color: theme.textMuted }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4, fontFamily: "PlayfairDisplay_700Bold" },
  meta: { fontSize: 14, marginBottom: 16, fontFamily: "Montserrat_400Regular" },
  primaryButton: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 24 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  addWineButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16 },
  addWineText: { fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12, fontFamily: "PlayfairDisplay_600SemiBold" },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  wineNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  wineName: { fontSize: 16, fontWeight: "600", flex: 1, fontFamily: "Montserrat_600SemiBold" },
  favoriteStar: { marginLeft: 4 },
  wineMeta: { fontSize: 14, marginTop: 4, fontFamily: "Montserrat_400Regular" },
  placeholder: { padding: 16, fontFamily: "Montserrat_400Regular" },
  shareButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16, flexDirection: "row", justifyContent: "center" },
  shareButtonText: { fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  endEventButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16 },
  endEventText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  deleteEventButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", marginBottom: 16 },
  deleteEventText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  rateButton: { borderRadius: 12, padding: 10, alignItems: "center", marginTop: 12 },
  rateButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  removeButton: { borderWidth: 1, borderRadius: 10, padding: 8, alignItems: "center", marginTop: 8, alignSelf: "flex-start" },
  removeButtonText: { fontSize: 14, fontWeight: "500", fontFamily: "Montserrat_400Regular" },
  resultRow: { marginTop: 12 },
  resultText: { fontSize: 15, fontFamily: "Montserrat_400Regular" },
});

function WineHostActions({
  eventId,
  wine,
  round,
  theme: t,
  onRate,
}: {
  eventId: string;
  wine: WineWithPricePrivacy;
  round: RatingRound | undefined;
  theme: ReturnType<typeof useTheme>;
  onRate: () => void;
}) {
  const startRound = useStartRatingRound(eventId, wine.id);
  const endRound = useEndRatingRound(round?.id ?? "", eventId, wine.id);

  const handleStartRound = () => {
    startRound.mutate(undefined, {
      onError: (err) =>
        Alert.alert("Could not start round", err instanceof Error ? err.message : "Something went wrong. Try again."),
    });
  };

  const handleEndRound = () => {
    endRound.mutate(undefined, {
      onError: (err) =>
        Alert.alert("Could not end round", err instanceof Error ? err.message : "Something went wrong. Try again."),
    });
  };

  if (round?.is_active) {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: t.secondary }]}
          onPress={onRate}
        >
          <Text style={styles.rateButtonText}>Rate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: t.textMuted }]}
          onPress={handleEndRound}
          disabled={endRound.isPending}
        >
          <Text style={styles.rateButtonText}>End round</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.rateButton, { backgroundColor: t.primary, marginTop: 12 }]}
      onPress={handleStartRound}
      disabled={startRound.isPending}
    >
      <Text style={styles.rateButtonText}>{startRound.isPending ? "Starting…" : "Start rating round"}</Text>
    </TouchableOpacity>
  );
}

function WineAdminReopen({
  eventId,
  wineId,
  theme: t,
}: {
  eventId: string;
  wineId: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const startRound = useStartRatingRound(eventId, wineId);
  const handleReopen = () => {
    startRound.mutate(undefined, {
      onError: (err) =>
        Alert.alert("Could not reopen round", err instanceof Error ? err.message : "Something went wrong. Try again."),
    });
  };
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <TouchableOpacity
        style={[styles.rateButton, { backgroundColor: t.textMuted }]}
        onPress={handleReopen}
        disabled={startRound.isPending}
      >
        <Text style={styles.rateButtonText}>{startRound.isPending ? "Starting…" : "Reopen ratings"}</Text>
      </TouchableOpacity>
    </View>
  );
}
