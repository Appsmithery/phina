import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent } from "@/lib/observability";
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

  const memberId = member?.id;
  useEffect(() => {
    if (memberId) trackEvent("cellar_opened");
  }, [memberId]);

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
        <Ionicons name="wine-outline" size={22} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>My Cellar</Text>
        <Ionicons name="notifications-outline" size={22} color={theme.textMuted} />
      </View>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/add-wine")}
      >
        <Text style={styles.addButtonText}>+ Add Wine</Text>
      </TouchableOpacity>
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
      <View style={[styles.searchWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.search, { color: theme.text }]}
          placeholder="Search your collection…"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
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
            const photoUrl = item.display_photo_url ?? item.label_photo_url ?? null;
            const destination = isEventWine
              ? `/event/${item.event_id}/wine/${item.id}`
              : `/wine/${item.id}`;

            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(destination)}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.thumbnail, { backgroundColor: theme.border }]}>
                    {photoUrl ? (
                      <Image
                        source={{ uri: photoUrl }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="wine-outline" size={20} color={theme.textMuted} />
                    )}
                  </View>
                  <View style={styles.cardContent}>
                    {item.region ? (
                      <Text style={[styles.cardRegion, { color: theme.primary }]}>
                        {item.region.toUpperCase()}
                      </Text>
                    ) : null}
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                      {wineLine.trim() || "Unnamed wine"}
                    </Text>
                    {item.producer ? (
                      <Text style={[styles.cardProducer, { color: theme.textSecondary }]}>
                        Producer: {item.producer}
                      </Text>
                    ) : null}
                    {drinkWindow && (
                      <View style={styles.drinkRow}>
                        <Ionicons name="calendar-outline" size={12} color={isPastWindow ? "#B55A5A" : theme.textMuted} style={styles.drinkIcon} />
                        <Text style={[styles.cardMeta, { color: isPastWindow ? "#B55A5A" : theme.textSecondary }]}>
                          {drinkWindow}{isPastWindow ? " (past window)" : ""}
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardFooter}>
                      {item.quantity != null && item.quantity >= 1 && (
                        <Text style={[styles.cardBottleCount, { color: theme.textMuted }]}>
                          {item.quantity} bottle{item.quantity !== 1 ? "s" : ""} left
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.manageButton, { backgroundColor: theme.primary }]}
                        onPress={() => router.push(destination)}
                      >
                        <Text style={styles.manageButtonText}>Manage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  addButton: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 12, alignItems: "center" },
  addButtonText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
  },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cardRow: { flexDirection: "row", gap: 12 },
  thumbnail: {
    width: 64,
    height: 80,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbnailImage: { width: "100%", height: "100%" },
  cardContent: { flex: 1 },
  cardRegion: { fontSize: 11, fontFamily: "Montserrat_600SemiBold", letterSpacing: 0.5, marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2, fontFamily: "PlayfairDisplay_600SemiBold" },
  cardProducer: { fontSize: 13, marginBottom: 4, fontFamily: "Montserrat_400Regular" },
  drinkRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  drinkIcon: { marginRight: 4 },
  cardMeta: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  cardBottleCount: { fontSize: 12, fontFamily: "Montserrat_400Regular" },
  manageButton: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  manageButtonText: { color: "#fff", fontSize: 12, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  placeholder: { padding: 24, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
