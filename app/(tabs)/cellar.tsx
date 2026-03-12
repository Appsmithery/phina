import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { BillingCard } from "@/components/BillingCard";
import { WineThumbnailImage } from "@/components/WineThumbnailImage";
import { TabScreenHeader } from "@/components/layout/TabScreenHeader";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent, captureError } from "@/lib/observability";
import { PAGE_HORIZONTAL_PADDING, getTabContentBottomPadding, useOptionalBottomTabBarHeight } from "@/lib/layout";
import type { WineWithPricePrivacy } from "@/types/database";
import type { Event } from "@/types/database";
import { useBilling } from "@/hooks/use-billing";
import { showAlert } from "@/lib/alert";

type CellarTab = "storage" | "history";

type WineWithEvent = WineWithPricePrivacy & {
  event: { title: string; date: string; status: string } | null;
};

export default function CellarScreen() {
  const theme = useTheme();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { member } = useSupabase();
  const {
    hasAdminBillingBypass,
    effectivePremiumActive,
    billingAccessLabel,
    nativePurchasesAvailable,
    isLoading: billingLoading,
    isPurchasingPremium,
    isRestoringPurchases,
    purchasePremium,
    restorePurchases,
  } = useBilling();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CellarTab>(params.tab === "history" ? "history" : "storage");

  const memberId = member?.id;
  useEffect(() => {
    if (memberId) {
      trackEvent("cellar_opened", { platform: Platform.OS, source: "cellar_tab" });
    }
  }, [memberId]);

  useEffect(() => {
    if (!memberId || billingLoading || effectivePremiumActive) return;
    trackEvent("premium_paywall_viewed", { platform: Platform.OS, source: "cellar_tab" });
  }, [billingLoading, effectivePremiumActive, memberId]);

  const {
    data: wines = [],
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cellar", "my-wines", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data: winesData, error: winesError } = await supabase
        .from("wines_with_price_privacy")
        .select("*")
        .eq("brought_by", member.id)
        .order("created_at", { ascending: false });
      if (winesError) {
        captureError(winesError, {
          screen: "cellar",
          query: "wines_with_price_privacy",
          member_id: member.id,
        });
        if (__DEV__) {
          console.warn("[cellar] wines query error:", winesError);
        }
        throw new Error(winesError.message || "Could not load your cellar.");
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

  const accessibleWines = useMemo(() => {
    if (effectivePremiumActive) return wines;
    return wines.filter((wine) => wine.event_id != null);
  }, [effectivePremiumActive, wines]);

  const hiddenPersonalWineCount = useMemo(() => {
    if (effectivePremiumActive) return 0;
    return wines.filter((wine) => wine.event_id == null).length;
  }, [effectivePremiumActive, wines]);

  const filtered = useMemo(() => {
    // First filter by tab
    const tabFiltered = accessibleWines.filter((w) =>
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
  }, [accessibleWines, search, tab]);

  const storageCt = useMemo(() => accessibleWines.filter((w) => w.status !== "consumed").length, [accessibleWines]);
  const historyCt = useMemo(() => accessibleWines.filter((w) => w.status === "consumed").length, [accessibleWines]);

  if (!member?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          Sign in to see your cellar.
        </Text>
      </View>
    );
  }

  const handlePurchasePremium = async () => {
    try {
      await purchasePremium();
      showAlert("Membership updated", "Your premium cellar access is now active.");
    } catch (error) {
      showAlert("Checkout failed", error instanceof Error ? error.message : "Could not start checkout.");
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
      showAlert("Purchases restored", "Your Apple purchases have been refreshed.");
    } catch (error) {
      showAlert("Restore failed", error instanceof Error ? error.message : "Could not restore purchases.");
    }
  };

  const cellarUpsell = !effectivePremiumActive ? (
    <View style={styles.upsellSection}>
      <BillingCard
        compact
        icon="wine-outline"
        title="Unlock Personal Cellar"
        description="Track your at-home bottles, uploads, and private cellar history."
        badge={hasAdminBillingBypass ? (billingAccessLabel ?? "Admin override") : "Cellar premium"}
        primaryLabel={
          Platform.OS === "ios" && !nativePurchasesAvailable
            ? "Use iOS Dev Build"
            : isPurchasingPremium
              ? "Opening checkout..."
              : Platform.OS === "ios"
                ? "Start Premium"
                : "Subscribe with Stripe"
        }
        onPrimaryPress={() => {
          void handlePurchasePremium();
        }}
        primaryDisabled={isPurchasingPremium || (Platform.OS === "ios" && !nativePurchasesAvailable)}
        secondaryLabel={
          Platform.OS === "ios" && nativePurchasesAvailable
            ? (isRestoringPurchases ? "Restoring..." : "Restore")
            : undefined
        }
        onSecondaryPress={
          Platform.OS === "ios" && nativePurchasesAvailable
            ? () => {
                void handleRestorePurchases();
              }
            : undefined
        }
        secondaryDisabled={Platform.OS === "ios" && nativePurchasesAvailable ? isRestoringPurchases : undefined}
      />
      {hiddenPersonalWineCount > 0 ? (
        <Text style={[styles.upsellHint, { color: theme.textMuted }]}>
          Premium is required to view {hiddenPersonalWineCount} personal cellar
          {hiddenPersonalWineCount === 1 ? " wine" : " wines"} that are not tied to an event.
        </Text>
      ) : null}
    </View>
  ) : null;

  if (billingLoading) {
    return (
      <View style={[styles.container, styles.centeredState, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Checking your membership...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Could not load your cellar</Text>
          <Text style={[styles.placeholder, { color: theme.textMuted }]}>
            {error instanceof Error ? error.message : "Please try again."}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => void refetch()}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TabScreenHeader
        title="My Cellar"
        left={<Ionicons name="wine-outline" size={22} color={theme.primary} />}
        right={
          <TouchableOpacity
            onPress={() =>
              Alert.alert("Coming soon", "Cellar alerts will notify you when wines are approaching their drinking window.")
            }
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.textMuted} />
          </TouchableOpacity>
        }
      />
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
      {isLoading ? (
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading your cellar...</Text>
      ) : filtered.length === 0 ? (
        <>
          <Text style={[styles.placeholder, { color: theme.textMuted }]}>
            {accessibleWines.length === 0
              ? effectivePremiumActive
                ? "Add wines to your personal cellar to track what you have at home."
                : "Bring a wine to an event to get started here, or unlock your personal cellar."
              : tab === "storage"
              ? "No wines in storage."
              : "No consumed wines yet."}
          </Text>
          {cellarUpsell}
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                getTabContentBottomPadding(tabBarHeight, 0) + (effectivePremiumActive ? 64 : 16),
            },
          ]}
          ListFooterComponent={cellarUpsell ? <View style={styles.listFooter}>{cellarUpsell}</View> : null}
          renderItem={({ item }) => {
            const isEventWine = item.event_id != null;
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
                  <WineThumbnailImage
                    uri={photoUrl}
                    backgroundColor={theme.border}
                    iconColor={theme.textMuted}
                  />
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
      {effectivePremiumActive ? (
        <View style={[styles.bottomButtonWrapper, { bottom: getTabContentBottomPadding(tabBarHeight, 0) - 8 }]}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/add-wine")}
          >
            <Text style={styles.addButtonText}>+ Add Wine</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredState: { justifyContent: "center" },
  bottomButtonWrapper: { position: "absolute", left: 0, right: 0, padding: PAGE_HORIZONTAL_PADDING },
  addButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  addButtonText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  errorState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12, fontFamily: "PlayfairDisplay_700Bold" },
  retryButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8 },
  retryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  tabRow: { flexDirection: "row", marginHorizontal: PAGE_HORIZONTAL_PADDING, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  upsellSection: { paddingHorizontal: PAGE_HORIZONTAL_PADDING, marginBottom: 16, gap: 8 },
  upsellHint: { fontSize: 12, lineHeight: 18, fontFamily: "Montserrat_400Regular" },
  listFooter: { paddingTop: 8 },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: PAGE_HORIZONTAL_PADDING,
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
  list: { padding: PAGE_HORIZONTAL_PADDING, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cardRow: { flexDirection: "row", gap: 12 },
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
