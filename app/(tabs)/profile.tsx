import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { showAlert } from "@/lib/alert";
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const DONATION_LINKS: Record<number, string> = {
  100: "https://buy.stripe.com/8x214p9RF4XRbCq2y64ZG00",
  500: "https://buy.stripe.com/cNi5kFfbZ2PJ21Q3Ca4ZG01",
  1000: "https://buy.stripe.com/aFaeVfbZNeyr21QdcK4ZG02",
};

export default function ProfileScreen() {
  const { member, session, refreshMember } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Personal Info edit mode
  const [editingInfo, setEditingInfo] = useState(false);
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [saving, setSaving] = useState(false);

  // Change password (collapsible inline form)
  const [pwExpanded, setPwExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(member?.name ?? "");
    setPhone(member?.phone ?? "");
  }, [member?.name, member?.phone]);

  const { data: ownRatings = [] } = useQuery({
    queryKey: ["profile", "ratings", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("ratings")
        .select("value, body, sweetness, tags, wine_id, wines!ratings_wine_id_fkey(color)")
        .eq("member_id", member.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!member?.id,
  });

  const { data: eventsCount = 0 } = useQuery({
    queryKey: ["profile", "event_members", member?.id],
    queryFn: async () => {
      if (!member?.id) return 0;
      const { count, error } = await supabase
        .from("event_members")
        .select("event_id", { count: "exact", head: true })
        .eq("member_id", member.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!member?.id,
  });

  const { data: favoritesCount = 0 } = useQuery({
    queryKey: ["profile", "favorites", member?.id],
    queryFn: async () => {
      if (!member?.id) return 0;
      const { count, error } = await supabase
        .from("event_favorites")
        .select("wine_id", { count: "exact", head: true })
        .eq("member_id", member.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!member?.id,
  });

  const stats = useMemo(() => {
    const PREF_WEIGHT: Record<number, number> = { 1: 3, 0: 1, [-1]: 0 };

    function weightedPreference(
      ratings: { value: number; trait: string | null }[],
      toNum: (v: string) => number,
    ): number | null {
      let sumWV = 0;
      let sumW = 0;
      for (const r of ratings) {
        if (r.trait == null) continue;
        const w = PREF_WEIGHT[r.value] ?? 0;
        if (w === 0) continue;
        sumW += w;
        sumWV += w * toNum(r.trait);
      }
      return sumW > 0 ? Math.round((sumWV / sumW) * 10) / 10 : null;
    }

    const bodyToNum = (v: string) => (v === "light" ? 1 : v === "medium" ? 2 : 3);
    const sweetnessToNum = (v: string) => (v === "dry" ? 1 : v === "off-dry" ? 2 : 3);
    const colorToNum = (v: string) => (v === "red" ? 1 : v === "skin-contact" ? 2 : 3);

    const total = ownRatings.length;
    const liked = ownRatings.filter((r) => r.value === 1).length;
    const pctLiked = total > 0 ? Math.round((liked / total) * 100) : 0;

    const prefBody = weightedPreference(
      ownRatings.map((r) => ({ value: r.value, trait: r.body })),
      bodyToNum,
    );
    const prefDryness = weightedPreference(
      ownRatings.map((r) => ({ value: r.value, trait: r.sweetness })),
      sweetnessToNum,
    );
    const prefColor = weightedPreference(
      ownRatings.map((r) => ({
        value: r.value,
        trait: r.wines?.color ?? null,
      })),
      colorToNum,
    );

    const ALL_TAGS = ["minerality", "fruit", "spice", "tannic"] as const;
    const tagScores: Record<string, number> = {};
    for (const r of ownRatings) {
      const w = PREF_WEIGHT[r.value] ?? 0;
      if (w === 0) continue;
      for (const tag of (r.tags ?? [])) {
        tagScores[tag] = (tagScores[tag] ?? 0) + w;
      }
    }
    const preferredTags = ALL_TAGS
      .filter((t) => (tagScores[t] ?? 0) > 0)
      .sort((a, b) => (tagScores[b] ?? 0) - (tagScores[a] ?? 0));
    const hasEnoughTagData = ownRatings.some((r) => (PREF_WEIGHT[r.value] ?? 0) > 0 && r.tags && r.tags.length > 0);

    return {
      totalRatings: total,
      liked,
      pctLiked,
      eventsAttended: eventsCount,
      favoritesCount,
      prefBody,
      prefDryness,
      prefColor,
      preferredTags,
      hasEnoughTagData,
    };
  }, [ownRatings, eventsCount, favoritesCount]);

  const saveProfile = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email!,
            name: name.trim() || null,
            phone: phone.trim() || null,
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      await refreshMember();
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setEditingInfo(false);
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const openDonation = async (amountCents: number) => {
    const base = DONATION_LINKS[amountCents];
    const params: string[] = [];
    if (session?.user?.email) params.push(`prefilled_email=${encodeURIComponent(session.user.email)}`);
    if (member?.id) params.push(`client_reference_id=${encodeURIComponent(member.id)}`);
    await Linking.openURL(params.length ? `${base}?${params.join("&")}` : base);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)");
  };

  const changePassword = async () => {
    if (!session?.user?.email) return;
    if (currentPassword.length === 0) {
      showAlert("Error", "Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("Error", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert("Error", "New passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (signInError) {
        showAlert("Error", "Current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert("Success", "Your password has been updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwExpanded(false);
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.profileHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.profileHeaderIcon} onPress={() => {}}>
          <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.profileHeaderTitle, { color: theme.text }]}>phína</Text>
        <TouchableOpacity style={styles.profileHeaderIcon} onPress={() => {}}>
          <Ionicons name="share-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {member?.id != null ? (
          <>
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push("/(tabs)/cellar?tab=history")}
              >
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.totalRatings}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="wine-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Wines Rated</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>
                  {stats.totalRatings > 0 ? `${stats.pctLiked}%` : "—"}
                </Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="thumbs-up-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Liked</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push("/(tabs)")}
              >
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.eventsAttended}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Events</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.favoritesCount}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="star-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Favorites</Text>
                </View>
              </View>
            </View>
            <View style={[styles.card, styles.preferencesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.tasteGraphHeader, { marginBottom: 16 }]}>
                <Ionicons name="bar-chart-outline" size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Your Taste Graph</Text>
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Body</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Light</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                    {stats.prefBody != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefBody - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Full</Text>
                </View>
                {stats.prefBody == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Dryness</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Dry</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                    {stats.prefDryness != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefDryness - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Sweet</Text>
                </View>
                {stats.prefDryness == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Palette</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Deep Red</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <LinearGradient
                      colors={["#8B2035", "#C4956A", "#F0EBE3"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.scaleTrack}
                    />
                    {stats.prefColor != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefColor - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtremeRight, { color: theme.textMuted }]}>Vibrant White</Text>
                </View>
                {stats.prefColor == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Preferred notes</Text>
                {stats.hasEnoughTagData ? (
                  stats.preferredTags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {stats.preferredTags.map((tag, idx) => (
                        <View
                          key={tag}
                          style={[
                            styles.tagChip,
                            idx === 0
                              ? { backgroundColor: theme.primary, borderColor: theme.primary }
                              : { backgroundColor: theme.primary + "20", borderColor: theme.primary },
                          ]}
                        >
                          <Text style={[styles.tagChipText, { color: idx === 0 ? "#fff" : theme.primary }]}>
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.noDataText, { color: theme.textMuted }]}>No tags on liked wines yet</Text>
                  )
                ) : (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>
            </View>
          </>
        ) : null}

        {Platform.OS !== "ios" && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.donateHeader}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Support phína</Text>
            </View>
            <Text style={[styles.donateDescription, { color: theme.textSecondary }]}>
              Help us keep the cellar growing.
            </Text>
            <View style={styles.donateButtons}>
              {[100, 500, 1000].map((cents) => (
                <TouchableOpacity
                  key={cents}
                  style={[styles.donateButton, { backgroundColor: theme.primary }]}
                  onPress={() => openDonation(cents)}
                >
                  <Text style={styles.donateButtonText}>${cents / 100}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header row */}
          <View style={styles.infoHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Personal Info</Text>
            {!editingInfo ? (
              <TouchableOpacity onPress={() => setEditingInfo(true)}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => {
                setName(member?.name ?? "");
                setPhone(member?.phone ?? "");
                setEditingInfo(false);
              }}>
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Email — always read-only */}
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{session?.user?.email ?? "—"}</Text>

          {/* Name */}
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
          {editingInfo ? (
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
            />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.name || "—"}</Text>
          )}

          {/* Phone */}
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
          {editingInfo ? (
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Your phone number"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.phone || "—"}</Text>
          )}

          {/* Save button (edit mode only) */}
          {editingInfo && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, marginTop: 4 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Change password toggle row */}
          <TouchableOpacity
            style={styles.pwToggleRow}
            onPress={() => setPwExpanded((v) => !v)}
          >
            <Text style={[styles.pwToggleText, { color: theme.text }]}>Change password</Text>
            <Ionicons
              name={pwExpanded ? "chevron-up" : "chevron-forward"}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {pwExpanded && (
            <View style={styles.pwForm}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Confirm new password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={changePassword}
                disabled={changingPassword}
              >
                <Text style={styles.buttonText}>{changingPassword ? "Updating…" : "Update password"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.signOut, { borderColor: theme.border }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: theme.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push("/privacy")}>
            <Text style={[styles.legalLink, { color: theme.textMuted }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={[styles.legalDot, { color: theme.textMuted }]}>&middot;</Text>
          <TouchableOpacity onPress={() => router.push("/terms")}>
            <Text style={[styles.legalLink, { color: theme.textMuted }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  signOut: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  signOutText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16, gap: 8 },
  legalLink: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  legalDot: { fontSize: 13 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  tileValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    marginBottom: 4,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileLabel: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  preferencesCard: {
    marginBottom: 24,
  },
  scaleContainer: {
    marginBottom: 16,
  },
  scaleLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  scaleTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scaleExtreme: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    width: 40,
  },
  scaleTrackWrapper: {
    flex: 1,
    height: 4,
    position: "relative",
  },
  scaleTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
  },
  scaleMarker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: -5,
    marginLeft: -7,
  },
  noDataText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  donateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  donateDescription: { fontSize: 13, fontFamily: "Montserrat_400Regular", marginBottom: 16, lineHeight: 20 },
  donateButtons: { flexDirection: "row", gap: 12 },
  donateButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  donateButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
  // Personal Info
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  infoLabel: { fontSize: 12, fontFamily: "Montserrat_400Regular", marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Montserrat_400Regular", marginBottom: 12 },
  cancelText: { fontSize: 14, fontFamily: "Montserrat_400Regular" },
  divider: { height: 1, marginVertical: 16 },
  pwToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pwToggleText: { fontFamily: "Montserrat_400Regular", fontSize: 15 },
  pwForm: { marginTop: 16 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  profileHeaderTitle: {
    fontFamily: "PlayfairDisplay_700BoldItalic",
    fontSize: 22,
    letterSpacing: 0.5,
  },
  profileHeaderIcon: {
    width: 36,
    alignItems: "center",
  },
  tasteGraphHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scaleExtremeRight: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    width: 52,
    textAlign: "right",
  },
});
