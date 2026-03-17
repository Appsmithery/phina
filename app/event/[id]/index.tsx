import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import QRCode from "react-native-qrcode-svg";
import { EventHeroImage } from "@/components/EventHeroImage";
import { WineThumbnailImage } from "@/components/WineThumbnailImage";
import { showAlert } from "@/lib/alert";
import { generateEventImage } from "@/lib/event-image-generation";
import {
  formatEventDateLong,
  formatEventTimeRange,
  isEventEnded,
} from "@/lib/event-scheduling";
import {
  useEndEvent,
  useEndRatingRound,
  useStartRatingRound,
} from "@/hooks/use-event-actions";
import { getScreenBottomPadding } from "@/lib/layout";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent } from "@/lib/observability";
import type {
  Event,
  RatingRound,
  WineWithPricePrivacy,
} from "@/types/database";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const isAuthenticated = sessionLoaded && !!session;
  const viewedEventIdRef = useRef<string | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .single();
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
      const { data, error } = await supabase
        .from("rating_rounds")
        .select("*")
        .eq("event_id", id!);
      if (error) throw error;
      return data as RatingRound[];
    },
    enabled: !!id && isAuthenticated && !!event,
  });

  const { data: ratingSummaries = [] } = useQuery({
    queryKey: ["event_rating_summary", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_wine_ratings", {
        p_event_id: id!,
      });
      if (error) throw error;
      return (data ?? []) as {
        wine_id: string;
        thumbs_up: number;
        meh: number;
        thumbs_down: number;
      }[];
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
    if (!event?.id || !isAuthenticated || viewedEventIdRef.current === event.id)
      return;
    viewedEventIdRef.current = event.id;
    trackEvent("event_detail_viewed", {
      platform: Platform.OS,
      event_id: event.id,
      status: event.status,
      tasting_mode: event.tasting_mode ?? null,
      source: "event_detail",
    });
  }, [event?.id, event?.status, event?.tasting_mode, isAuthenticated]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;

    const channel = supabase
      .channel(`event:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["event", id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wines",
          filter: `event_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wines", id] });
          queryClient.invalidateQueries({
            queryKey: ["event_rating_summary", id],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rating_rounds",
          filter: `event_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rating_rounds", id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_members",
          filter: `event_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["event_members_count", id],
          });
        },
      )
      .subscribe((status, err) => {
        if (__DEV__)
          console.log(`[realtime] event:${id} status=${status}`, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isAuthenticated, queryClient]);

  const [qrExpanded, setQrExpanded] = useState(false);

  const isHost = event?.created_by === member?.id;
  const eventClosed = event ? isEventEnded(event) : false;
  const isDoubleBlind =
    event?.tasting_mode === "double_blind" && !eventClosed;
  const hideWineDetails = isDoubleBlind && !isHost;
  const canSeeMetrics = isHost || member?.is_admin;
  const canDeleteEvent = isHost || member?.is_admin;
  const endEventMutation = useEndEvent(id!);
  const appBaseUrl =
    process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

  const handleShareInvite = async () => {
    const joinUrl = `${appBaseUrl}/join/${id}`;
    const message = `Join my wine tasting event: ${joinUrl}`;

    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({
            title: event?.title ?? "Wine Tasting",
            url: joinUrl,
          });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(joinUrl);
          showAlert(
            "Link copied",
            "The invite link has been copied to your clipboard.",
          );
        } else {
          window.prompt("Copy the invite link:", joinUrl);
        }
      } else {
        await Share.share(
          Platform.OS === "ios"
            ? { url: joinUrl, message: "Join my wine tasting event" }
            : { message },
        );
      }
    } catch {
      // Ignore cancelled share sheet.
    }
  };

  const handleOpenWebLink = async () => {
    if (!event?.web_link) return;

    const url = /^https?:\/\//i.test(event.web_link)
      ? event.web_link
      : `https://${event.web_link}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      showAlert(
        "Could not open link",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleRegenerateHeroImage = async () => {
    if (!event) return;

    const { error } = await supabase
      .from("events")
      .update({ event_image_status: "pending" })
      .eq("id", event.id);

    if (error) {
      showAlert(
        "Error",
        error.message ?? "Could not start hero image generation.",
      );
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["event", id] });
    showAlert("Hero image", "Hero image generation started.");
    void (async () => {
      const result = await generateEventImage(
        event.id,
        event.title,
        event.theme,
        event.description ?? null,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);

      if (result.ok) {
        showAlert("Hero image", "Hero image refreshed.");
        return;
      }

      showAlert(
        "Hero image failed",
        result.error || "Hero image generation failed. Try again later.",
      );
    })();
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
            const { error } = await supabase
              .from("events")
              .delete()
              .eq("id", id!);
            if (error) {
              showAlert("Error", error.message ?? "Could not delete event.");
              return;
            }

            queryClient.invalidateQueries({ queryKey: ["events"] });
            router.replace("/(tabs)");
          },
        },
      ],
    );
  };

  if (!id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Sign in to view this event.
        </Text>
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
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  const eventDateLabel = formatEventDateLong(event.starts_at, event.timezone);
  const eventTimeLabel = formatEventTimeRange(
    event.starts_at,
    event.ends_at,
    event.timezone,
  );

  const listHeader = (
    <>
      {event.event_image_url ? (
        <EventHeroImage
          uri={event.event_image_url}
          backgroundColor={theme.surface}
          style={styles.heroCard}
        />
      ) : null}

      <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
      <View style={styles.metaRow}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${theme.primary}20` },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: theme.primary }]}>
            {eventClosed ? "ENDED EVENT" : "ACTIVE EVENT"}
          </Text>
        </View>
        {event.tasting_mode ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  event.tasting_mode === "double_blind"
                    ? "#6B4C8A20"
                    : `${theme.textSecondary}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color:
                    event.tasting_mode === "double_blind"
                      ? "#6B4C8A"
                      : theme.textSecondary,
                },
              ]}
            >
              {event.tasting_mode === "double_blind"
                ? "DOUBLE BLIND"
                : "SINGLE BLIND"}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {event.theme} - {eventDateLabel} - {eventTimeLabel}
        </Text>
      </View>

      <Text style={[styles.scheduleHint, { color: theme.textMuted }]}>
        Event ends automatically at {eventTimeLabel.split("-")[1]}. Rating rounds close after{" "}
        {event.default_rating_window_minutes} minutes.
      </Text>

      {event.description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {event.description}
        </Text>
      ) : null}

      {canSeeMetrics ? (
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricTile,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={22}
              color={theme.textSecondary}
            />
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {guestCount ?? "-"}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Guests
            </Text>
          </View>
          <View
            style={[
              styles.metricTile,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="wine-outline"
              size={22}
              color={theme.textSecondary}
            />
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {wines.length}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Wines
            </Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.primaryActionRow,
          { backgroundColor: theme.primary, borderColor: theme.primary },
        ]}
        onPress={() => router.push(`/event/${id}/add-wine`)}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.primaryActionLabel}>Add wine</Text>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>

      {isHost ? (
        <>
          <TouchableOpacity
            style={[
              styles.actionRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setQrExpanded((v) => !v)}
          >
            <Ionicons name="qr-code-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              Show QR code
            </Text>
            <Ionicons
              name={qrExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {qrExpanded ? (
            <View
              style={[
                styles.qrContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <QRCode value={`${appBaseUrl}/join/${id}`} size={220} />
              <Text style={[styles.qrHint, { color: theme.textMuted }]}>
                Members scan this code at the venue to join.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.actionRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={handleShareInvite}
          >
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              Share invite link
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => router.push(`/event/${id}/edit`)}
          >
            <Ionicons name="create-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              Edit event details
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={handleRegenerateHeroImage}
            disabled={event.event_image_status === "pending"}
          >
            <Ionicons name="image-outline" size={20} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              {event.event_image_status === "pending"
                ? "Generating hero image..."
                : event.event_image_url
                  ? "Regenerate hero image"
                  : "Generate hero image"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {event.event_image_status === "pending" ? (
            <Text style={[styles.statusMessage, { color: theme.textMuted }]}>
              Hero image generation started.
            </Text>
          ) : null}

          {event.event_image_status === "failed" ? (
            <Text style={[styles.statusMessage, { color: "#B55A5A" }]}>
              Hero image generation failed. Try again later.
            </Text>
          ) : null}
        </>
      ) : null}

      {event.web_link ? (
        <TouchableOpacity
          style={[
            styles.actionRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={handleOpenWebLink}
        >
          <Ionicons name="link-outline" size={20} color={theme.text} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>
            Open event link
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[
          styles.actionRow,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={() =>
          router.push({
            pathname: "/feedback",
            params: {
              source: "report_event_content",
              screen: "/event/[id]",
              eventId: event.id,
              category: "report_user_content",
              reportTarget: "event",
              reportTargetId: event.id,
              reportedMemberId: event.created_by,
            },
          })
        }
      >
        <Ionicons name="alert-circle-outline" size={20} color={theme.text} />
        <Text style={[styles.actionLabel, { color: theme.text }]}>
          Report event content
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {(isHost && !eventClosed) || canDeleteEvent ? (
        <View style={styles.dangerRow}>
          {isHost && !eventClosed ? (
            <TouchableOpacity
              style={[
                styles.actionRowHalf,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() =>
                showAlert(
                  "End event?",
                  "Results will be revealed to everyone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "End event",
                      style: "destructive",
                      onPress: () => endEventMutation.mutate(),
                    },
                  ],
                )
              }
              disabled={endEventMutation.isPending}
            >
              <Ionicons name="flag-outline" size={20} color={theme.textMuted} />
              <Text style={[styles.actionLabel, { color: theme.textMuted }]}>
                End event
              </Text>
            </TouchableOpacity>
          ) : null}

          {canDeleteEvent ? (
            <TouchableOpacity
              style={[
                styles.actionRowHalf,
                { backgroundColor: theme.surface, borderColor: "#B55A5A30" },
              ]}
              onPress={handleDeleteEvent}
            >
              <Ionicons name="trash-outline" size={20} color="#B55A5A" />
              <Text style={[styles.actionLabel, { color: "#B55A5A" }]}>
                Delete event
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Wines</Text>
      {wines.length === 0 ? (
        <View
          style={[styles.emptyWinesContainer, { borderColor: theme.border }]}
        >
          <Ionicons
            name="wine-outline"
            size={40}
            color={theme.textMuted}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No wines added yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Tap "Add wine" above to get started.
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={wines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => {
          const activeRound = rounds.find(
            (round) => round.wine_id === item.id && round.is_active,
          );
          const round =
            activeRound ??
            rounds.find((candidate) => candidate.wine_id === item.id);
          const summary = ratingSummaries.find(
            (candidate) => candidate.wine_id === item.id,
          );
          const wineLabel = hideWineDetails ? `Wine #${index + 1}` : null;
          const quantityPrefix =
            item.quantity != null && item.quantity > 1
              ? `${item.quantity}x `
              : "";
          const photoUrl = !hideWineDetails
            ? (item.display_photo_url ?? item.label_photo_url ?? null)
            : null;
          const quantityLabel =
            item.quantity != null && item.quantity >= 1
              ? `${item.quantity} bottle${item.quantity === 1 ? "" : "s"}`
              : null;
          const titleText =
            wineLabel ??
            `${quantityPrefix}${item.producer ?? "Unknown"} ${item.varietal ?? ""} ${item.vintage ?? ""}`.trim();
          const subtitleText = hideWineDetails
            ? "Details stay hidden during this double-blind tasting."
            : (item.region ?? null);
          const priceText =
            !hideWineDetails &&
            (item.price_cents != null || item.price_range != null)
              ? item.price_cents != null
                ? `$${item.price_cents / 100}`
                : (item.price_range ?? "")
              : null;

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.push(`/event/${id}/wine/${item.id}`)}
              >
                <View style={styles.cardRow}>
                  <WineThumbnailImage
                    uri={photoUrl}
                    backgroundColor={theme.border}
                    iconColor={theme.textMuted}
                    fallbackIconName={
                      hideWineDetails ? "eye-off-outline" : "wine-outline"
                    }
                  />
                  <View style={styles.cardContent}>
                    <View style={styles.wineNameRow}>
                      <Text
                        style={[styles.wineName, { color: theme.text }]}
                        numberOfLines={2}
                      >
                        {titleText}
                      </Text>
                      {eventFavorite?.wine_id === item.id ? (
                        <Ionicons
                          name="star"
                          size={18}
                          color={theme.primary}
                          style={styles.favoriteStar}
                        />
                      ) : null}
                    </View>

                    {subtitleText ? (
                      <Text
                        style={[
                          styles.wineMeta,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {subtitleText}
                      </Text>
                    ) : null}

                    {priceText ? (
                      <Text
                        style={[
                          styles.wineMeta,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {priceText}
                      </Text>
                    ) : null}

                    {quantityLabel ? (
                      <Text
                        style={[
                          styles.cardBottleCount,
                          { color: theme.textMuted },
                        ]}
                      >
                        {quantityLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>

      {eventClosed && summary ? (
        <View style={styles.resultRow}>
                  <Text style={[styles.resultText, { color: theme.text }]}>
                    Up {summary.thumbs_up} Meh {summary.meh} Down{" "}
                    {summary.thumbs_down}
                  </Text>
                </View>
              ) : null}

              {!eventClosed && isHost ? (
                <WineHostActions
                  eventId={id!}
                  wine={item}
                  round={activeRound ?? round}
                  defaultRoundDurationMinutes={event.default_rating_window_minutes}
                  theme={theme}
                  onRate={() => router.push(`/event/${id}/rate/${item.id}`)}
                />
              ) : null}

              {!eventClosed && !isHost && activeRound ? (
                <TouchableOpacity
                  style={[
                    styles.rateButton,
                    { backgroundColor: theme.secondary },
                  ]}
                  onPress={() => router.push(`/event/${id}/rate/${item.id}`)}
                >
                  <Text style={styles.rateButtonText}>Rate</Text>
                </TouchableOpacity>
              ) : null}

              {!eventClosed &&
              !isHost &&
              !activeRound &&
              member?.is_admin ? (
                <WineAdminReopen
                  eventId={id!}
                  wineId={item.id}
                  defaultRoundDurationMinutes={event.default_rating_window_minutes}
                  theme={theme}
                />
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingTop: 16, paddingBottom: getScreenBottomPadding(0) },
  heroCard: {
    marginBottom: 16,
    aspectRatio: 4 / 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  meta: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  scheduleHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  metricTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
  },
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
  primaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  primaryActionLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
  },
  primaryButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 4,
    fontFamily: "PlayfairDisplay_600SemiBold",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: { flexDirection: "row", gap: 12 },
  cardContent: { flex: 1 },
  wineNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  wineName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    fontFamily: "Montserrat_600SemiBold",
  },
  favoriteStar: { marginLeft: 4 },
  wineMeta: { fontSize: 14, marginTop: 4, fontFamily: "Montserrat_400Regular" },
  cardBottleCount: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: "Montserrat_400Regular",
  },
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
  emptyTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  rateButton: {
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    marginTop: 12,
  },
  rateButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  rateButtonLight: {
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  rateButtonLightText: {
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  resultRow: { marginTop: 12 },
  resultText: { fontSize: 15, fontFamily: "Montserrat_400Regular" },
  statusMessage: {
    fontSize: 13,
    marginTop: -2,
    marginBottom: 12,
    fontFamily: "Montserrat_400Regular",
  },
  qrContainer: {
    alignItems: "center",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  qrHint: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  dangerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  actionRowHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    justifyContent: "center",
  },
});

function WineHostActions({
  eventId,
  wine,
  round,
  defaultRoundDurationMinutes,
  theme: t,
  onRate,
}: {
  eventId: string;
  wine: WineWithPricePrivacy;
  round: RatingRound | undefined;
  defaultRoundDurationMinutes: 5 | 10 | 15;
  theme: ReturnType<typeof useTheme>;
  onRate: () => void;
}) {
  const startRound = useStartRatingRound(
    eventId,
    wine.id,
    defaultRoundDurationMinutes,
  );
  const endRound = useEndRatingRound(round?.id ?? "", eventId, wine.id);

  const handleStartRound = () => {
    startRound.mutate(undefined, {
      onError: (error) =>
        showAlert(
          "Could not start round",
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
        ),
    });
  };

  const handleEndRound = () => {
    endRound.mutate(undefined, {
      onError: (error) =>
        showAlert(
          "Could not end round",
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
        ),
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
      style={[
        styles.rateButtonLight,
        {
          backgroundColor: `${t.primary}18`,
          borderColor: `${t.primary}26`,
          marginTop: 12,
        },
      ]}
      onPress={handleStartRound}
      disabled={startRound.isPending}
    >
      <Text style={[styles.rateButtonLightText, { color: t.primary }]}>
        {startRound.isPending ? "Starting..." : "Start Rating"}
      </Text>
    </TouchableOpacity>
  );
}

function WineAdminReopen({
  eventId,
  wineId,
  defaultRoundDurationMinutes,
  theme: t,
}: {
  eventId: string;
  wineId: string;
  defaultRoundDurationMinutes: 5 | 10 | 15;
  theme: ReturnType<typeof useTheme>;
}) {
  const startRound = useStartRatingRound(
    eventId,
    wineId,
    defaultRoundDurationMinutes,
  );

  const handleReopen = () => {
    startRound.mutate(undefined, {
      onError: (error) =>
        showAlert(
          "Could not reopen round",
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
        ),
    });
  };

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <TouchableOpacity
        style={[
          styles.rateButtonLight,
          {
            backgroundColor: `${t.textMuted}18`,
            borderColor: `${t.textMuted}26`,
          },
        ]}
        onPress={handleReopen}
        disabled={startRound.isPending}
      >
        <Text style={[styles.rateButtonLightText, { color: t.textSecondary }]}>
          {startRound.isPending ? "Starting..." : "Reopen ratings"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
