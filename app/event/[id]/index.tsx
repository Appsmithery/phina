import { useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Share, Platform, Image, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { showAlert } from "@/lib/alert";
import { useEndEvent, useEndRatingRound, useStartRatingRound } from "@/hooks/use-event-actions";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { Event, RatingRound, WineWithPricePrivacy } from "@/types/database";

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
      const { data, error } = await supabase
        .from("wines_with_price_privacy")
        .select("*")
        .eq("event_id", id!)
        .order("created_at", { ascending: true });
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

  const { data: guestCount } = useQuery({
    queryKey: ["event_members_count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("event_members")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id && isAuthenticated,
  });

  useEffect(() => {
    if (!id || !isAuthenticated) return;

    const channel = supabase
      .channel(`event:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["event", id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wines", filter: `event_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wines", id] });
          queryClient.invalidateQueries({ queryKey: ["event_rating_summary", id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rating_rounds", filter: `event_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rating_rounds", id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_members", filter: `event_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["event_members_count", id] });
        }
      )
      .subscribe((status, err) => {
        if (__DEV__) console.log(`[realtime] event:${id} status=${status}`, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isAuthenticated, queryClient]);

  const isHost = event?.created_by === member?.id;
  const isDoubleBlind = event?.tasting_mode === "double_blind" && event?.status === "active";
  const hideWineDetails = isDoubleBlind && !isHost;
  const canSeeMetrics = isHost || member?.is_admin;
  const canDeleteEvent = isHost || member?.is_admin;
  const endEventMutation = useEndEvent(id!);
  const appBaseUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

  const handleShareInvite = async () => {
    const joinUrl = `${appBaseUrl}/join/${id}`;
    const message = `Join my wine tasting event: ${joinUrl}`;

    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: event?.title ?? "Wine Tasting", url: joinUrl });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(joinUrl);
          showAlert("Link copied", "The invite link has been copied to your clipboard.");
        } else {
          window.prompt("Copy the invite link:", joinUrl);
        }
      } else {
        await Share.share(
          Platform.OS === "ios"
            ? { url: joinUrl, message: "Join my wine tasting event" }
            : { message }
        );
      }
    } catch {
      // Ignore cancelled share sheet.
    }
  };

  const handleOpenPartiful = async () => {
    if (!event?.partiful_url) return;

    const url = /^https?:\/\//i.test(event.partiful_url) ? event.partiful_url : `https://${event.partiful_url}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      showAlert("Could not open link", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const handleDeleteEvent = () => {
    showAlert(
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
              showAlert("Error", error.message ?? "Could not delete event.");
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
    showAlert(
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
              showAlert("Error", error.message ?? "Could not remove wine.");
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
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  const eventDateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString();

  const listHeader = (
    <>
      {event.event_image_url ? (
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Image source={{ uri: event.event_image_url }} style={styles.heroImage} resizeMode="cover" />
        </View>
      ) : null}

      <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
      <View style={styles.metaRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${theme.primary}20` }]}>
          <Text style={[styles.statusBadgeText, { color: theme.primary }]}>
            {event.status === "active" ? "ACTIVE EVENT" : "PAST EVENT"}
          </Text>
        </View>
        {event.tasting_mode ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  event.tasting_mode === "double_blind" ? "#6B4C8A20" : `${theme.textSecondary}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: event.tasting_mode === "double_blind" ? "#6B4C8A" : theme.textSecondary },
              ]}
            >
              {event.tasting_mode === "double_blind" ? "DOUBLE BLIND" : "SINGLE BLIND"}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {event.theme} - {eventDateLabel}
        </Text>
      </View>

      {event.description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>{event.description}</Text>
      ) : null}

      {canSeeMetrics ? (
        <View style={styles.metricsRow}>
          <View style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={22} color={theme.textSecondary} />
            <Text style={[styles.metricValue, { color: theme.text }]}>{guestCount ?? "-"}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Guests</Text>
          </View>
          <View style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="wine-outline" size={22} color={theme.textSecondary} />
            <Text style={[styles.metricValue, { color: theme.text }]}>{wines.length}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Wines</Text>
          </View>
        </View>
      ) : null}

      {isHost ? (
        <>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push(`/event/${id}/qr`)}
          >
            <Ionicons name="qr-code-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Show QR code</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleShareInvite}
          >
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Share invite link</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </>
      ) : null}

      {event.partiful_url ? (
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleOpenPartiful}
        >
          <Ionicons name="link-outline" size={20} color={theme.text} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>View Partiful Invite</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {isHost && event.status === "active" ? (
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            showAlert("End event?", "Results will be revealed to everyone.", [
              { text: "Cancel", style: "cancel" },
              { text: "End event", style: "destructive", onPress: () => endEventMutation.mutate() },
            ])
          }
          disabled={endEventMutation.isPending}
        >
          <Ionicons name="flag-outline" size={20} color={theme.textMuted} />
          <Text style={[styles.actionLabel, { color: theme.textMuted }]}>End event</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {canDeleteEvent ? (
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: "#B55A5A30" }]}
          onPress={handleDeleteEvent}
        >
          <Ionicons name="trash-outline" size={20} color="#B55A5A" />
          <Text style={[styles.actionLabel, { color: "#B55A5A" }]}>Delete event</Text>
          <Ionicons name="chevron-forward" size={18} color="#B55A5A60" />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}40` }]}
        onPress={() => router.push(`/event/${id}/add-wine`)}
      >
        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
        <Text style={[styles.actionLabel, { color: theme.primary }]}>Add wine</Text>
        <Ionicons name="chevron-forward" size={18} color={`${theme.primary}80`} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Wines</Text>
      {wines.length === 0 ? (
        <View style={[styles.emptyWinesContainer, { borderColor: theme.border }]}>
          <Ionicons name="wine-outline" size={40} color={theme.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No wines added yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Tap "Add wine" above to get started.</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={wines}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => {
          const activeRound = rounds.find((round) => round.wine_id === item.id && round.is_active);
          const round = activeRound ?? rounds.find((candidate) => candidate.wine_id === item.id);
          const summary = ratingSummaries.find((candidate) => candidate.wine_id === item.id);
          const canRemove = isHost || item.brought_by === member?.id;
          const wineLabel = hideWineDetails ? `Wine #${index + 1}` : null;
          const quantityPrefix = item.quantity != null && item.quantity > 1 ? `${item.quantity}x ` : "";

          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TouchableOpacity onPress={() => router.push(`/event/${id}/wine/${item.id}`)}>
                <View style={styles.wineNameRow}>
                  <Text style={[styles.wineName, { color: theme.text }]}>
                    {wineLabel ?? `${quantityPrefix}${item.producer ?? "Unknown"} ${item.varietal ?? ""} ${item.vintage ?? ""}`.trim()}
                  </Text>
                  {eventFavorite?.wine_id === item.id ? (
                    <Ionicons name="star" size={18} color={theme.primary} style={styles.favoriteStar} />
                  ) : null}
                </View>

                {!hideWineDetails && item.region ? (
                  <Text style={[styles.wineMeta, { color: theme.textSecondary }]}>{item.region}</Text>
                ) : null}

                {!hideWineDetails && (item.price_cents != null || item.price_range != null) ? (
                  <Text style={[styles.wineMeta, { color: theme.textSecondary }]}>
                    {item.price_cents != null ? `$${item.price_cents / 100}` : item.price_range ?? ""}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {event.status === "ended" && summary ? (
                <View style={styles.resultRow}>
                  <Text style={[styles.resultText, { color: theme.text }]}>
                    Up {summary.thumbs_up}  Meh {summary.meh}  Down {summary.thumbs_down}
                  </Text>
                </View>
              ) : null}

              {event.status === "active" && isHost ? (
                <WineHostActions
                  eventId={id!}
                  wine={item}
                  round={activeRound ?? round}
                  theme={theme}
                  onRate={() => router.push(`/event/${id}/rate/${item.id}`)}
                />
              ) : null}

              {event.status === "active" && !isHost && activeRound ? (
                <TouchableOpacity
                  style={[styles.rateButton, { backgroundColor: theme.secondary }]}
                  onPress={() => router.push(`/event/${id}/rate/${item.id}`)}
                >
                  <Text style={styles.rateButtonText}>Rate</Text>
                </TouchableOpacity>
              ) : null}

              {event.status === "active" && !isHost && !activeRound && member?.is_admin ? (
                <WineAdminReopen eventId={id!} wineId={item.id} theme={theme} />
              ) : null}

              {canRemove ? (
                <TouchableOpacity
                  style={[styles.removeButton, { borderColor: theme.textMuted }]}
                  onPress={() => handleRemoveWine(item)}
                >
                  <Text style={[styles.removeButtonText, { color: theme.textMuted }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
  },
  heroImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8, fontFamily: "PlayfairDisplay_700Bold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
  meta: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  metricTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center", gap: 4 },
  metricValue: { fontSize: 26, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginTop: 4 },
  metricLabel: { fontSize: 12, marginTop: 2, fontFamily: "Montserrat_400Regular" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  actionLabel: { flex: 1, fontFamily: "Montserrat_600SemiBold", fontSize: 15 },
  primaryButton: { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 24 },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12, marginTop: 4, fontFamily: "PlayfairDisplay_600SemiBold" },
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
  emptyWinesContainer: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 16, marginBottom: 6 },
  emptySubtitle: { fontFamily: "Montserrat_400Regular", fontSize: 13, textAlign: "center" },
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
      onError: (error) =>
        showAlert("Could not start round", error instanceof Error ? error.message : "Something went wrong. Try again."),
    });
  };

  const handleEndRound = () => {
    endRound.mutate(undefined, {
      onError: (error) =>
        showAlert("Could not end round", error instanceof Error ? error.message : "Something went wrong. Try again."),
    });
  };

  if (round?.is_active) {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[styles.rateButton, { backgroundColor: t.secondary }]} onPress={onRate}>
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
      <Text style={styles.rateButtonText}>{startRound.isPending ? "Starting..." : "Start rating round"}</Text>
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
      onError: (error) =>
        showAlert("Could not reopen round", error instanceof Error ? error.message : "Something went wrong. Try again."),
    });
  };

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <TouchableOpacity
        style={[styles.rateButton, { backgroundColor: t.textMuted }]}
        onPress={handleReopen}
        disabled={startRound.isPending}
      >
        <Text style={styles.rateButtonText}>{startRound.isPending ? "Starting..." : "Reopen ratings"}</Text>
      </TouchableOpacity>
    </View>
  );
}
