import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Event } from "@/types/database";

type WineWithEvent = WineWithPricePrivacy & {
  event: { title: string; date: string; status: string } | null;
};

export default function LibraryScreen() {
  const theme = useTheme();
  const { member } = useSupabase();
  const [search, setSearch] = useState("");

  const { data: wines = [] } = useQuery({
    queryKey: ["library", "my-wines", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data: winesData, error: winesError } = await supabase
        .from("wines_with_price_privacy")
        .select("*")
        .eq("brought_by", member.id)
        .order("created_at", { ascending: false });
      if (winesError) throw winesError;
      const list = (winesData ?? []) as WineWithPricePrivacy[];
      if (list.length === 0) return [];
      const eventIds = [...new Set(list.map((w) => w.event_id).filter((id): id is string => id != null))];
      const eventsMap = new Map<string, Pick<Event, "id" | "title" | "date" | "status">>();
      if (eventIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id, title, date, status")
          .in("id", eventIds);
        if (eventsError) throw eventsError;
        ((eventsData ?? []) as Pick<Event, "id" | "title" | "date" | "status">[]).forEach((e) => eventsMap.set(e.id, e));
      }
      return list.map((w) => ({
        ...w,
        event: w.event_id != null ? (eventsMap.get(w.event_id) ?? null) : null,
      })) as WineWithEvent[];
    },
    enabled: !!member?.id,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wines;
    return wines.filter((w) => {
      const producer = (w.producer ?? "").toLowerCase();
      const varietal = (w.varietal ?? "").toLowerCase();
      const region = (w.region ?? "").toLowerCase();
      const eventTitle = (w.event?.title ?? "").toLowerCase();
      const vintage = w.vintage != null ? String(w.vintage) : "";
      return (
        producer.includes(q) ||
        varietal.includes(q) ||
        region.includes(q) ||
        eventTitle.includes(q) ||
        vintage.includes(q)
      );
    });
  }, [wines, search]);

  if (!member?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Sign in to see your library.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>My wines</Text>
      <TextInput
        style={[styles.search, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        placeholder="Search by producer, varietal, event…"
        placeholderTextColor={theme.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      {filtered.length === 0 ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          {wines.length === 0
            ? "Wines you add to events will appear here."
            : "No wines match your search."}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isEventWine = item.event_id != null;
            const eventTitle = item.event?.title ?? (isEventWine ? "Unknown event" : null);
            const eventDate = item.event?.date
              ? new Date(item.event.date).toLocaleDateString()
              : "";
            const wineLine = [
              item.quantity != null && item.quantity > 1 ? `${item.quantity}×` : "",
              item.producer ?? "Unknown",
              item.varietal ?? "",
              item.vintage ?? "",
            ]
              .filter(Boolean)
              .join(" ");
            const cardContent = (
              <>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{wineLine.trim() || "Unnamed wine"}</Text>
                {item.region ? (
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{item.region}</Text>
                ) : null}
                {(item.price_cents != null || item.price_range != null) && (
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {item.price_cents != null ? `$${item.price_cents / 100}` : item.price_range ?? ""}
                  </Text>
                )}
                <Text style={[styles.cardEvent, { color: theme.textMuted }]}>
                  {eventTitle != null ? `${eventTitle}${eventDate ? ` · ${eventDate}` : ""}` : "Personal library"}
                </Text>
              </>
            );
            if (isEventWine) {
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => router.push(`/event/${item.event_id}/wine/${item.id}`)}
                >
                  {cardContent}
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(`/wine/${item.id}/edit`)}
              >
                {cardContent}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  cardMeta: { fontSize: 14, marginBottom: 2 },
  cardEvent: { fontSize: 12 },
  placeholder: { padding: 24, textAlign: "center" },
});
