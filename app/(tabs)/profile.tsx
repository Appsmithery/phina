import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Share, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ProfileEmptyState } from "@/components/ProfileEmptyState";
import { trackEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { showAlert } from "@/lib/alert";

let ImagePicker: typeof import("expo-image-picker") | undefined;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
}

const DONATION_LINKS: Record<number, string> = {
  100: "https://buy.stripe.com/8x214p9RF4XRbCq2y64ZG00",
  500: "https://buy.stripe.com/cNi5kFfbZ2PJ21Q3Ca4ZG01",
  1000: "https://buy.stripe.com/aFaeVfbZNeyr21QdcK4ZG02",
};
const AVATARS_BUCKET = "avatars";

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "ENTHUSIAST",
  intermediate: "CONNOISSEUR",
  advanced: "SOMMELIER LEVEL I",
  professional: "SOMMELIER LEVEL II",
};

export default function ProfileScreen() {
  const { member, session, refreshMember } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const { data: ownRatings = [], isLoading: ownRatingsLoading } = useQuery({
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

  const { data: eventsCount = 0, isLoading: eventsCountLoading } = useQuery({
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

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]));

  const stats = useMemo(() => {
    const weights: Record<number, number> = { 1: 3, 0: 1, [-1]: 0 };
    const weightedPreference = (
      ratings: { value: number; trait: string | null }[],
      toNum: (value: string) => number,
    ) => {
      let sumWV = 0;
      let sumW = 0;
      for (const rating of ratings) {
        if (rating.trait == null) continue;
        const weight = weights[rating.value] ?? 0;
        if (weight === 0) continue;
        sumW += weight;
        sumWV += weight * toNum(rating.trait);
      }
      return sumW > 0 ? Math.round((sumWV / sumW) * 10) / 10 : null;
    };

    const totalRatings = ownRatings.length;
    const liked = ownRatings.filter((rating) => rating.value === 1).length;
    const tagScores: Record<string, number> = {};
    for (const rating of ownRatings) {
      const weight = weights[rating.value] ?? 0;
      if (weight === 0) continue;
      for (const tag of rating.tags ?? []) {
        tagScores[tag] = (tagScores[tag] ?? 0) + weight;
      }
    }

    return {
      totalRatings,
      pctLiked: totalRatings > 0 ? Math.round((liked / totalRatings) * 100) : 0,
      eventsAttended: eventsCount,
      favoritesCount,
      prefBody: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.body })), (value) => value === "light" ? 1 : value === "medium" ? 2 : 3),
      prefDryness: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.sweetness })), (value) => value === "dry" ? 1 : value === "off-dry" ? 2 : 3),
      prefColor: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.wines?.color ?? null })), (value) => value === "red" ? 1 : value === "skin-contact" ? 2 : 3),
      preferredTags: (["minerality", "fruit", "spice", "tannic", "oak", "floral"] as const)
        .filter((tag) => (tagScores[tag] ?? 0) > 0)
        .sort((a, b) => (tagScores[b] ?? 0) - (tagScores[a] ?? 0)),
      hasEnoughTagData: ownRatings.some((rating) => (weights[rating.value] ?? 0) > 0 && (rating.tags?.length ?? 0) > 0),
    };
  }, [ownRatings, eventsCount, favoritesCount]);

  const isTopSectionLoading = ownRatingsLoading || eventsCountLoading;
  const shouldShowProfileEmptyState = member?.id != null && !isTopSectionLoading && stats.totalRatings === 0;

  useEffect(() => {
    if (shouldShowProfileEmptyState) trackEvent("profile_empty_state_viewed");
  }, [shouldShowProfileEmptyState]);

  const handleProfileEmptyStatePress = () => {
    trackEvent("profile_empty_state_cta_tapped");
    router.push("/(tabs)");
  };

  const initials = useMemo(() => {
    const f = (member?.first_name ?? "")[0]?.toUpperCase() ?? "";
    const l = (member?.last_name ?? "")[0]?.toUpperCase() ?? "";
    return f + l || "?";
  }, [member?.first_name, member?.last_name]);

  const experienceLabel = EXPERIENCE_LABELS[member?.wine_experience ?? ""] ?? "WINE EXPLORER";

  const memberSinceText = useMemo(() => {
    if (!member?.created_at) return "";
    const d = new Date(member.created_at);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [member?.created_at]);

  const handleShare = async () => {
    try {
      await Share.share({ message: "Check out my taste profile on Phina!" });
    } catch {
      // user cancelled
    }
  };

  const openDonation = async (amountCents: number) => {
    const { Linking } = await import("react-native");
    const base = DONATION_LINKS[amountCents];
    const params: string[] = [];
    if (session?.user?.email) params.push(`prefilled_email=${encodeURIComponent(session.user.email)}`);
    if (member?.id) params.push(`client_reference_id=${encodeURIComponent(member.id)}`);
    await Linking.openURL(params.length ? `${base}?${params.join("&")}` : base);
  };

  const refreshProfileData = useCallback(async () => {
    await refreshMember();
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }, [queryClient, refreshMember]);

  const uploadAvatarBlob = useCallback(async (blob: Blob) => {
    if (!member?.id) return;

    setAvatarBusy(true);
    const previousStoragePath = member.avatar_source === "upload" ? member.avatar_storage_path : null;

    try {
      const path = `${member.id}/avatar-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(uploadData.path);
      const { error: updateError } = await supabase
        .from("members")
        .update({
          avatar_url: urlData.publicUrl,
          avatar_storage_path: uploadData.path,
          avatar_source: "upload",
        })
        .eq("id", member.id);
      if (updateError) throw updateError;

      if (previousStoragePath && previousStoragePath !== uploadData.path) {
        await supabase.storage.from(AVATARS_BUCKET).remove([previousStoragePath]);
      }

      await refreshProfileData();
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not update your photo.");
    } finally {
      setAvatarBusy(false);
    }
  }, [member?.avatar_source, member?.avatar_storage_path, member?.id, refreshProfileData]);

  const handlePickAvatar = useCallback(async () => {
    if (!member?.id || avatarBusy) return;

    if (Platform.OS === "web") {
      webFileInputRef.current?.click();
      return;
    }

    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Permission needed", "Allow access to your photos to choose an avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const response = await fetch(result.assets[0].uri);
    const blob = await response.blob();
    await uploadAvatarBlob(blob);
  }, [avatarBusy, member?.id, uploadAvatarBlob]);

  const handleWebFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAvatarBlob(file);
    if (webFileInputRef.current) webFileInputRef.current.value = "";
  }, [uploadAvatarBlob]);

  const handleRemoveAvatar = useCallback(async () => {
    if (!member?.id || avatarBusy) return;

    setAvatarBusy(true);
    try {
      if (member.avatar_source === "upload" && member.avatar_storage_path) {
        const { error: removeError } = await supabase.storage
          .from(AVATARS_BUCKET)
          .remove([member.avatar_storage_path]);
        if (removeError) throw removeError;
      }

      const { error: updateError } = await supabase
        .from("members")
        .update({
          avatar_url: null,
          avatar_storage_path: null,
          avatar_source: "removed",
        })
        .eq("id", member.id);
      if (updateError) throw updateError;

      await refreshProfileData();
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not remove your photo.");
    } finally {
      setAvatarBusy(false);
    }
  }, [avatarBusy, member?.avatar_source, member?.avatar_storage_path, member?.id, refreshProfileData]);

  const renderTopSection = () => {
    if (member?.id == null || isTopSectionLoading) return null;
    if (shouldShowProfileEmptyState) {
      return <ProfileEmptyState theme={theme} onCtaPress={handleProfileEmptyStatePress} />;
    }
    return (
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
            <Text style={[styles.tileValue, { color: theme.text }]}>{stats.totalRatings > 0 ? `${stats.pctLiked}%` : "-"}</Text>
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

          {[
            ["Body", "Light", "Full", stats.prefBody],
            ["Dryness", "Dry", "Sweet", stats.prefDryness],
          ].map(([label, left, right, pref]) => (
            <View key={String(label)} style={styles.scaleContainer}>
              <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>{label}</Text>
              <View style={styles.scaleTrackRow}>
                <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>{left}</Text>
                <View style={styles.scaleTrackWrapper}>
                  <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                  {pref != null && (
                    <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((Number(pref) - 1) / 2) * 100}%` }]} />
                  )}
                </View>
                <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>{right}</Text>
              </View>
              {pref == null && <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>}
            </View>
          ))}

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
            {stats.prefColor == null && <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>}
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
                          : { backgroundColor: `${theme.primary}20`, borderColor: theme.primary },
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
    );
  };

  const displayName = [member?.first_name, member?.last_name].filter(Boolean).join(" ");
  const hasAvatar = Boolean(member?.avatar_url);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {Platform.OS === "web" && (
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleWebFileChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
          style={{ display: "none" }}
        />
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/settings")} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSummary}>
          {hasAvatar ? (
            <Image
              source={{ uri: member?.avatar_url ?? "" }}
              style={styles.avatarImage}
              testID="profile-avatar-image"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.primary }]} testID="profile-avatar-fallback">
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarActions}>
            <TouchableOpacity
              style={[styles.avatarActionButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={handlePickAvatar}
              disabled={avatarBusy}
            >
              <Text style={[styles.avatarActionText, { color: theme.textSecondary }]}>
                {avatarBusy ? "Updating..." : hasAvatar ? "Change photo" : "Add photo"}
              </Text>
            </TouchableOpacity>
            {hasAvatar ? (
              <TouchableOpacity onPress={handleRemoveAvatar} disabled={avatarBusy}>
                <Text style={[styles.removeAvatarText, { color: avatarBusy ? theme.textMuted : theme.primary }]}>
                  Remove photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {displayName ? (
            <Text style={[styles.profileName, { color: theme.text }]}>{displayName}</Text>
          ) : null}
          <Text style={[styles.profileLevel, { color: theme.primary }]}>{experienceLabel}</Text>
          {memberSinceText ? (
            <Text style={[styles.memberSince, { color: theme.textMuted }]}>
              Member since {memberSinceText}
            </Text>
          ) : null}
        </View>

        {renderTopSection()}

        {Platform.OS !== "ios" && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.donateHeader}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Support Phina</Text>
            </View>
            <Text style={[styles.donateDescription, { color: theme.textSecondary }]}>Help us keep the cellar growing.</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  profileSummary: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Montserrat_600SemiBold",
  },
  avatarActions: {
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  avatarActionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  avatarActionText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },
  removeAvatarText: {
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
  },
  profileName: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 4,
  },
  profileLevel: {
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 24 },
  cardTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  statTile: { width: "48%", borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  tileValue: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, marginBottom: 4 },
  tileLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { fontFamily: "Montserrat_400Regular", fontSize: 13, textAlign: "center" },
  preferencesCard: { marginBottom: 24 },
  scaleContainer: { marginBottom: 16 },
  scaleLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, marginBottom: 8 },
  scaleTrackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scaleExtreme: { fontFamily: "Montserrat_400Regular", fontSize: 11, width: 40 },
  scaleTrackWrapper: { flex: 1, height: 4, position: "relative" },
  scaleTrack: { width: "100%", height: 4, borderRadius: 2 },
  scaleMarker: { position: "absolute", width: 14, height: 14, borderRadius: 7, top: -5, marginLeft: -7 },
  noDataText: { fontFamily: "Montserrat_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 },
  tasteGraphHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  scaleExtremeRight: { fontFamily: "Montserrat_400Regular", fontSize: 11, width: 52, textAlign: "right" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
  donateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  donateDescription: { fontSize: 13, fontFamily: "Montserrat_400Regular", marginBottom: 16, lineHeight: 20 },
  donateButtons: { flexDirection: "row", gap: 12 },
  donateButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  donateButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
});
