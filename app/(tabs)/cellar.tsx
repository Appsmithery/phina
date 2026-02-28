import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Event } from "@/types/database";

type CellarTab = "storage" | "history";

type WineWithEvent = WineWithPricePrivacy & {
  event: { title: string; date: string; status: string } | null;
};

export default function CellarScreen() {
  const theme = useTheme();
  const { member } = useSupabase();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CellarTab>(params.tab === "history" ? "history" : "storage");

  const { data: wines = [] } = useQuery({
    queryKey: ["cellar", "my-wines", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data: winesData, error: winesError } = await supabase
        .from("wines_with_price_privacy")
        .select("*")
        .eq("brought_by", member.id)
        .order("created_at", { ascending: false });
      if (winesError) {
        console.error("[cellar] wines query error:", JSON.stringify(winesError));
        throw winesError;
      }
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
    // First filter by tab
    const tabFiltered = wines.filter((w) =>
      tab === "storage" ? w.status !== "consumed" : w.status === "consumed"
    );
    // Then filter by search
    const q = search.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter((w) => {
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
  }, [wines, search, tab]);

  const storageCt = useMemo(() => wines.filter((w) => w.status !== "consumed").length, [wines]);
  const historyCt = useMemo(() => wines.filter((w) => w.status === "consumed").length, [wines]);

  if (!member?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Sign in to see your cellar.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>My Cellar</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/add-wine")}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "storage" && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setTab("storage")}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === "storage" ? theme.primary : theme.textMuted },
            ]}
          >
            In Storage ({storageCt})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "history" && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === "history" ? theme.primary : theme.textMuted },
            ]}
          >
            History ({historyCt})
          </Text>
        </TouchableOpacity>
      </View>
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
            ? "Add wines to your personal cellar to track what you have at home."
            : tab === "storage"
            ? "No wines in storage."
            : "No consumed wines yet."}
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
            const drinkWindow =
              item.drink_from != null && item.drink_until != null
                ? `Drink ${item.drink_from}–${item.drink_until}`
                : item.drink_from != null
                ? `Drink from ${item.drink_from}`
                : item.drink_until != null
                ? `Drink until ${item.drink_until}`
                : null;
            const isPastWindow = item.drink_until != null && item.drink_until < new Date().getFullYear();
            const cardContent = (
              <>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{wineLine.trim() || "Unnamed wine"}</Text>
                {item.region ? (
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{item.region}</Text>
                ) : null}
                {drinkWindow && (
                  <Text style={[styles.cardMeta, { color: isPastWindow ? "#B55A5A" : theme.textSecondary }]}>
                    {drinkWindow}{isPastWindow ? " (past window)" : ""}
                  </Text>
                )}
                {(item.price_cents != null || item.price_range != null) && (
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {item.price_cents != null ? `$${item.price_cents / 100}` : item.price_range ?? ""}
                  </Text>
                )}
                <Text style={[styles.cardEvent, { color: theme.textMuted }]}>
                  {eventTitle != null ? `${eventTitle}${eventDate ? ` · ${eventDate}` : ""}` : "Personal cellar"}
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
                onPress={() => router.push(`/wine/${item.id}`)}
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  addButton: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  addButtonText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4, fontFamily: "PlayfairDisplay_600SemiBold" },
  cardMeta: { fontSize: 14, marginBottom: 2, fontFamily: "Montserrat_400Regular" },
  cardEvent: { fontSize: 12, fontFamily: "Montserrat_300Light" },
  placeholder: { padding: 24, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
