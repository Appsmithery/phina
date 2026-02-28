import { useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useMembers, useToggleAdmin } from "@/hooks/use-members";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";
import type { Member } from "@/types/database";

export default function AdminScreen() {
  const router = useRouter();
  const { member: currentMember } = useSupabase();

  useEffect(() => {
    if (currentMember === null) return;
    if (currentMember && !currentMember.is_admin) {
      router.replace("/(tabs)");
    }
  }, [currentMember, router]);
  const { data: members = [], isLoading } = useMembers();
  const toggleAdmin = useToggleAdmin();
  const theme = useTheme();

  const { data: memberCount } = useQuery({
    queryKey: ["admin_count_members"],
    queryFn: async () => {
      const { count, error } = await supabase.from("members").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!currentMember?.is_admin,
  });

  const { data: eventCount } = useQuery({
    queryKey: ["admin_count_events"],
    queryFn: async () => {
      const { count, error } = await supabase.from("events").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!currentMember?.is_admin,
  });

  const { data: wineCount } = useQuery({
    queryKey: ["admin_count_wines"],
    queryFn: async () => {
      const { count, error } = await supabase.from("wines").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!currentMember?.is_admin,
  });

  const handleToggle = (m: Pick<Member, "id" | "name" | "email" | "is_admin">) => {
    if (m.id === currentMember?.id) {
      showAlert("Cannot demote yourself", "An admin cannot remove their own admin status.");
      return;
    }
    const newVal = !m.is_admin;
    toggleAdmin.mutate(
      { memberId: m.id, isAdmin: newVal },
      {
        onError: (e) => showAlert("Error", e instanceof Error ? e.message : "Could not update"),
      }
    );
  };

  if (currentMember && !currentMember.is_admin) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>Loading members…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.metricsRow}>
        <View style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.text }]}>{memberCount ?? "—"}</Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Members</Text>
        </View>
        <View style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.text }]}>{eventCount ?? "—"}</Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Events</Text>
        </View>
        <View style={[styles.metricTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.text }]}>{wineCount ?? "—"}</Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Wines</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Members</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardMain}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name || "—"}</Text>
              <Text style={[styles.email, { color: theme.textSecondary }]}>{item.email}</Text>
              {item.is_admin && (
                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: item.is_admin ? theme.textMuted : theme.primary,
                },
              ]}
              onPress={() => handleToggle(item)}
              disabled={toggleAdmin.isPending}
            >
              <Text style={styles.toggleBtnText}>{item.is_admin ? "Demote" : "Promote"}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  metricsRow: { flexDirection: "row", gap: 12, padding: 16, paddingBottom: 0 },
  metricTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center" },
  metricValue: { fontSize: 22, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  metricLabel: { fontSize: 12, marginTop: 2, fontFamily: "Montserrat_400Regular" },
  title: { fontSize: 24, fontWeight: "700", padding: 16, fontFamily: "PlayfairDisplay_700Bold" },
  list: { padding: 16, paddingTop: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMain: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", marginBottom: 2, fontFamily: "Montserrat_600SemiBold" },
  email: { fontSize: 14, fontFamily: "Montserrat_400Regular" },
  badge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  toggleBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toggleBtnText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  placeholder: { padding: 24, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
