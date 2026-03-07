import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/lib/alert";
import { getPendingJoinEventId, clearPendingJoinEventId } from "@/lib/pending-join";
import { US_STATES, getStateLabel } from "@/lib/us-states";
import { stripPhone, isValidPhone } from "@/lib/validation";
import { BirthdayPickerField } from "@/components/BirthdayPickerField";
import { formatBirthdayForStorage, getAge } from "@/lib/birthday";

const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "professional"] as const;

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  professional: "Professional",
};

export default function OnboardingScreen() {
  const { session, refreshMember } = useSupabase();
  const theme = useTheme();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [wineExperience, setWineExperience] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!session?.user?.id) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      showAlert("Required", "Please enter your first name.");
      return;
    }
    if (!trimmedLast) {
      showAlert("Required", "Please enter your last name.");
      return;
    }
    if (!birthday) {
      showAlert("Required", "Please enter your birthday.");
      return;
    }
    if (getAge(birthday) < 21) {
      showAlert("Age Requirement", "You must be at least 21 years old to use Phína.");
      return;
    }
    const phoneDigits = stripPhone(phone);
    if (phoneDigits.length > 0 && !isValidPhone(phone)) {
      showAlert("Invalid Phone", "Please enter a valid 10-digit phone number.");
      return;
    }

    setSaving(true);
    try {
      const birthdayStr = formatBirthdayForStorage(birthday);
      const { error } = await supabase.from("members").upsert(
        {
          id: session.user.id,
          email: session.user.email!,
          first_name: trimmedFirst,
          last_name: trimmedLast,
          birthday: birthdayStr,
          phone: phoneDigits || null,
          city: city.trim() || null,
          state: stateCode,
          wine_experience: wineExperience as any,
          profile_complete: true,
        },
        { onConflict: "id" },
      );
      if (error) throw error;

      await refreshMember();

      // Check for pending event join
      const pendingId = await getPendingJoinEventId();
      if (pendingId) {
        await clearPendingJoinEventId();
        router.replace(`/join/${pendingId}`);
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.text }]}>Welcome to Phína</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Tell us a bit about yourself to get started.
          </Text>

          {/* First Name */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            First name <Text style={{ color: theme.primary }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={theme.textMuted}
            autoFocus
            autoCapitalize="words"
            autoComplete="given-name"
          />

          {/* Last Name */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Last name <Text style={{ color: theme.primary }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            autoComplete="family-name"
          />

          {/* Birthday */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Birthday <Text style={{ color: theme.primary }}>*</Text>
          </Text>
          <BirthdayPickerField
            value={birthday}
            onChange={setBirthday}
            theme={theme}
            backgroundColor={theme.surface}
            hintText="Used for age verification. You must be at least 21, and your birthday is kept private."
          />

          {/* Phone */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Phone (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Your phone number"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          {/* City */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>City (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={theme.textMuted}
          />

          {/* State */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>State (optional)</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setShowStatePicker(!showStatePicker)}
          >
            <Text style={{ color: stateCode ? theme.text : theme.textMuted, fontFamily: "Montserrat_400Regular", fontSize: 16 }}>
              {stateCode ? getStateLabel(stateCode) : "Select state"}
            </Text>
          </TouchableOpacity>
          {showStatePicker && (
            <View style={[styles.statePickerContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ScrollView style={styles.statePickerScroll} nestedScrollEnabled>
                {US_STATES.map((s) => {
                  const selected = stateCode === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.stateOption, selected && { backgroundColor: theme.primary + "15" }]}
                      onPress={() => { setStateCode(selected ? null : s.value); setShowStatePicker(false); }}
                    >
                      <Text style={[styles.stateOptionText, { color: selected ? theme.primary : theme.text }]}>
                        {s.value} — {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Wine Experience */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Wine experience (optional)</Text>
          <View style={styles.pillRow}>
            {EXPERIENCE_LEVELS.map((level) => {
              const selected = wineExperience === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setWineExperience(selected ? null : level)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: selected ? "#fff" : theme.textSecondary },
                    ]}
                  >
                    {EXPERIENCE_LABELS[level]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Email (read-only) */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <Text style={[styles.readOnlyValue, { color: theme.textMuted }]}>
            {session?.user?.email ?? "—"}
          </Text>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.submitButtonText}>{saving ? "Setting up…" : "Get Started"}</Text>
          </TouchableOpacity>

          {/* Legal links */}
          <Text style={[styles.consentText, { color: theme.textMuted }]}>
            By continuing, you agree to our{" "}
            <Text style={{ color: theme.primary }} onPress={() => router.push("/terms")}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={{ color: theme.primary }} onPress={() => router.push("/privacy")}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 48 },
  inner: { maxWidth: 400, width: "100%", alignSelf: "center" },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 16,
  },
  dateButton: {
    justifyContent: "center",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },
  statePickerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  statePickerScroll: {
    maxHeight: 200,
  },
  stateOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stateOptionText: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
  },
  readOnlyValue: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 24,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  consentText: {
    fontSize: 12,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
});
