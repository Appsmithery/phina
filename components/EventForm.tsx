import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { showAlert } from "@/lib/alert";
import { getModerationErrorMessage } from "@/lib/content-moderation";
import {
  combineLocalDateAndTime,
  getDeviceTimeZone,
  RATING_WINDOW_OPTIONS,
} from "@/lib/event-scheduling";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

let ImagePicker: typeof import("expo-image-picker") | undefined;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
}

const EVENT_IMAGES_BUCKET = "event-images";

export interface EventFormInitialValues {
  title: string;
  theme: string;
  description: string;
  webLink: string;
  date: string;
  startTime: string;
  endTime: string;
  ratingWindowMinutes: 5 | 10 | 15;
  tastingMode: "single_blind" | "double_blind";
  heroImageUrl?: string | null;
  heroImageStatus?: "none" | "pending" | "generated" | "uploaded" | "failed";
}

export interface EventFormValues {
  title: string;
  theme: string;
  description: string | null;
  webLink: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  defaultRatingWindowMinutes: 5 | 10 | 15;
  tastingMode: "single_blind" | "double_blind";
  heroImageUrl: string | null;
  heroImageStatus: "none" | "pending" | "generated" | "uploaded" | "failed";
}

interface EventFormProps {
  heading: string;
  submitLabel: string;
  initialValues: EventFormInitialValues;
  memberId: string | null;
  isSubmitting?: boolean;
  showHeading?: boolean;
  minDate?: Date;
  tastingModeLocked?: boolean;
  tastingModeLockedReason?: string;
  onSubmit: (values: EventFormValues) => void | Promise<void>;
}

export function normalizeWebLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function extractStoragePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${EVENT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

export function EventForm({
  heading,
  submitLabel,
  initialValues,
  memberId,
  isSubmitting = false,
  showHeading = true,
  minDate,
  tastingModeLocked = false,
  tastingModeLockedReason,
  onSubmit,
}: EventFormProps) {
  const theme = useTheme();
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(initialValues.title);
  const [themeText, setThemeText] = useState(initialValues.theme);
  const [description, setDescription] = useState(initialValues.description);
  const [webLink, setWebLink] = useState(initialValues.webLink);
  const [selectedDate, setSelectedDate] = useState(
    new Date(`${initialValues.date}T00:00:00`),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [tastingMode, setTastingMode] = useState<
    "single_blind" | "double_blind"
  >(initialValues.tastingMode);
  const [ratingWindowMinutes, setRatingWindowMinutes] = useState<
    5 | 10 | 15
  >(initialValues.ratingWindowMinutes);
  const [ratingWindowModalVisible, setRatingWindowModalVisible] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(
    initialValues.heroImageUrl ?? null,
  );
  const [heroImageStatus, setHeroImageStatus] = useState<
    "none" | "pending" | "generated" | "uploaded" | "failed"
  >(initialValues.heroImageStatus ?? "none");
  const [uploadingHero, setUploadingHero] = useState(false);
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [endTime, setEndTime] = useState(initialValues.endTime);

  useEffect(() => {
    setTitle(initialValues.title);
    setThemeText(initialValues.theme);
    setDescription(initialValues.description);
    setWebLink(initialValues.webLink);
    setSelectedDate(new Date(`${initialValues.date}T00:00:00`));
    setTastingMode(initialValues.tastingMode);
    setStartTime(initialValues.startTime);
    setEndTime(initialValues.endTime);
    setRatingWindowMinutes(initialValues.ratingWindowMinutes);
    setHeroImageUrl(initialValues.heroImageUrl ?? null);
    setHeroImageStatus(initialValues.heroImageStatus ?? "none");
  }, [
    initialValues.date,
    initialValues.description,
    initialValues.endTime,
    initialValues.heroImageStatus,
    initialValues.heroImageUrl,
    initialValues.ratingWindowMinutes,
    initialValues.startTime,
    initialValues.tastingMode,
    initialValues.theme,
    initialValues.title,
    initialValues.webLink,
  ]);

  const date = selectedDate.toISOString().slice(0, 10);
  const timezone = useMemo(() => getDeviceTimeZone(), []);
  const startDateValue = useMemo(() => timeToDate(startTime), [startTime]);
  const endDateValue = useMemo(() => timeToDate(endTime), [endTime]);

  const onDateChange = (_event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (picked) setSelectedDate(picked);
  };

  const handleTimeChange = (
    kind: "start" | "end",
    _event: DateTimePickerEvent,
    picked?: Date,
  ) => {
    if (Platform.OS === "android") {
      if (kind === "start") setShowStartTimePicker(false);
      if (kind === "end") setShowEndTimePicker(false);
    }

    if (!picked) return;

    const nextValue = `${String(picked.getHours()).padStart(2, "0")}:${String(
      picked.getMinutes(),
    ).padStart(2, "0")}`;
    if (kind === "start") setStartTime(nextValue);
    if (kind === "end") setEndTime(nextValue);
  };

  const uploadHeroBlob = async (blob: Blob) => {
    if (!memberId) {
      showAlert("Sign in required", "Sign in to upload an event hero photo.");
      return;
    }

    setUploadingHero(true);
    const previousPath = extractStoragePathFromPublicUrl(heroImageUrl);

    try {
      const path = `${memberId}/hero-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(EVENT_IMAGES_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(EVENT_IMAGES_BUCKET)
        .getPublicUrl(uploadData.path);

      setHeroImageUrl(urlData.publicUrl);
      setHeroImageStatus("uploaded");

      if (previousPath && previousPath !== uploadData.path) {
        await supabase.storage.from(EVENT_IMAGES_BUCKET).remove([previousPath]);
      }
    } catch (error) {
      showAlert(
        "Upload failed",
        error instanceof Error ? error.message : "Could not upload the hero photo.",
      );
    } finally {
      setUploadingHero(false);
    }
  };

  const handlePickHero = async () => {
    if (!memberId || uploadingHero) return;

    if (Platform.OS === "web") {
      webFileInputRef.current?.click();
      return;
    }

    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert(
        "Permission needed",
        "Allow access to your photos to choose an event hero image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const response = await fetch(result.assets[0].uri);
    const blob = await response.blob();
    await uploadHeroBlob(blob);
  };

  const handleRemoveHero = async () => {
    const existingPath = extractStoragePathFromPublicUrl(heroImageUrl);
    if (existingPath) {
      await supabase.storage.from(EVENT_IMAGES_BUCKET).remove([existingPath]);
    }

    setHeroImageUrl(null);
    setHeroImageStatus("none");
  };

  const handleWebFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadHeroBlob(file);
    if (webFileInputRef.current) webFileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    const startsAt = combineLocalDateAndTime(date, startTime);
    const endsAt = combineLocalDateAndTime(date, endTime);

    const moderationError = getModerationErrorMessage([
      { label: "Title", value: title },
      { label: "Theme", value: themeText },
      { label: "Description", value: description },
    ]);
    if (moderationError) {
      showAlert("Update required", moderationError);
      return;
    }

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      showAlert(
        "Invalid schedule",
        "End time must be later than the start time.",
      );
      return;
    }

    void onSubmit({
      title: title.trim(),
      theme: themeText.trim() || "Tasting",
      description: description.trim() || null,
      webLink: normalizeWebLink(webLink),
      date,
      startsAt,
      endsAt,
      timezone,
      defaultRatingWindowMinutes: ratingWindowMinutes,
      tastingMode,
      heroImageUrl,
      heroImageStatus,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {Platform.OS === "web" ? (
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleWebFileChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
          style={{ display: "none" }}
        />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showHeading ? (
            <Text style={[styles.title, { color: theme.text }]}>{heading}</Text>
          ) : null}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Event Hero
            </Text>
            {heroImageUrl ? (
              <Image source={{ uri: heroImageUrl }} style={styles.heroImage} />
            ) : (
              <View
                style={[
                  styles.heroPlaceholder,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <Text
                  style={[styles.heroPlaceholderText, { color: theme.textMuted }]}
                >
                  {uploadingHero
                    ? "Uploading hero photo..."
                    : "Upload a host photo or leave this blank to use an AI hero image."}
                </Text>
              </View>
            )}
            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
                onPress={handlePickHero}
                disabled={uploadingHero || !memberId}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  {heroImageUrl ? "Replace photo" : "Upload photo"}
                </Text>
              </TouchableOpacity>
              {heroImageUrl ? (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                  onPress={() => {
                    void handleRemoveHero();
                  }}
                >
                  <Text
                    style={[styles.secondaryButtonText, { color: theme.textMuted }]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Title
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Alpine Night"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Theme
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={themeText}
              onChangeText={setThemeText}
              placeholder="e.g. Alpine, Burgundy Night, Rose"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell your guests what to expect..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Date
            </Text>
            {Platform.OS === "web" ? (
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                value={date}
                onChange={(event: any) => {
                  const value = event?.target?.value;
                  if (value) setSelectedDate(new Date(`${value}T00:00:00`));
                }}
                // @ts-expect-error web-only prop
                type="date"
                min={minDate ? minDate.toISOString().slice(0, 10) : undefined}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateInput,
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDisplayDate(selectedDate)}
                  </Text>
                </TouchableOpacity>
                {showDatePicker ? (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                    minimumDate={minDate}
                    themeVariant="light"
                  />
                ) : null}
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Start Time
            </Text>
            {Platform.OS === "web" ? (
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                value={startTime}
                onChange={(event: any) => {
                  const value = event?.target?.value;
                  if (value) setStartTime(value);
                }}
                // @ts-expect-error web-only prop
                type="time"
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateInput,
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setShowStartTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDisplayTime(startTime)}
                  </Text>
                </TouchableOpacity>
                {showStartTimePicker ? (
                  <DateTimePicker
                    value={startDateValue}
                    mode="time"
                    display="spinner"
                    is24Hour
                    onChange={(event, picked) =>
                      handleTimeChange("start", event, picked)
                    }
                    themeVariant="light"
                  />
                ) : null}
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              End Time
            </Text>
            {Platform.OS === "web" ? (
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                value={endTime}
                onChange={(event: any) => {
                  const value = event?.target?.value;
                  if (value) setEndTime(value);
                }}
                // @ts-expect-error web-only prop
                type="time"
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateInput,
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setShowEndTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDisplayTime(endTime)}
                  </Text>
                </TouchableOpacity>
                {showEndTimePicker ? (
                  <DateTimePicker
                    value={endDateValue}
                    mode="time"
                    display="spinner"
                    is24Hour
                    onChange={(event, picked) =>
                      handleTimeChange("end", event, picked)
                    }
                    themeVariant="light"
                  />
                ) : null}
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Rating Window
            </Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateInput,
                { borderColor: theme.border },
              ]}
              onPress={() => setRatingWindowModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateText, { color: theme.text }]}>
                {ratingWindowMinutes} min
              </Text>
            </TouchableOpacity>

            <Modal
              visible={ratingWindowModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setRatingWindowModalVisible(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setRatingWindowModalVisible(false)}
              >
                <View
                  style={[
                    styles.modalContent,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Rating Window
                  </Text>
                  {RATING_WINDOW_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.modalOption,
                        ratingWindowMinutes === option && {
                          backgroundColor: `${theme.primary}20`,
                        },
                      ]}
                      onPress={() => {
                        setRatingWindowMinutes(option);
                        setRatingWindowModalVisible(false);
                      }}
                    >
                      <Text
                        style={[styles.modalOptionText, { color: theme.text }]}
                      >
                        {option} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Text style={[styles.modeHint, { color: theme.textSecondary }]}>
              Events end automatically at the selected end time. Rating rounds
              close automatically after {ratingWindowMinutes} minutes.
            </Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Web Link (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={webLink}
              onChangeText={setWebLink}
              placeholder="your-event-site.com/tickets"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={[styles.modeHint, { color: theme.textSecondary }]}>
              Use this for an external event page, ticketing site, or RSVP link.
              Purchases stay on your own website.
            </Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Tasting Mode
            </Text>
            <View
              style={[
                styles.modeRow,
                {
                  borderColor: theme.border,
                  opacity: tastingModeLocked ? 0.6 : 1,
                },
              ]}
            >
              {(["single_blind", "double_blind"] as const).map((mode) => {
                const active = tastingMode === mode;

                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modePill,
                      active && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      if (!tastingModeLocked) setTastingMode(mode);
                    }}
                    activeOpacity={0.7}
                    disabled={tastingModeLocked}
                  >
                    <Text
                      style={[
                        styles.modePillText,
                        { color: active ? "#fff" : theme.text },
                      ]}
                    >
                      {mode === "single_blind"
                        ? "Single Blind"
                        : "Double Blind"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modeHint, { color: theme.textSecondary }]}>
              {tastingModeLocked
                ? (tastingModeLockedReason ??
                  "Tasting mode is locked once wines or ratings exist.")
                : tastingMode === "single_blind"
                  ? "Guests see wine details but not results until the event ends."
                  : "Guests see only wine numbers. Details are revealed when the event ends."}
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              disabled={isSubmitting || !title.trim()}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Saving..." : submitLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  heroImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
  },
  heroPlaceholder: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginBottom: 10,
  },
  heroPlaceholderText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
  label: { fontSize: 12, marginBottom: 4, fontFamily: "Montserrat_400Regular" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  dateInput: { justifyContent: "center" },
  dateText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  modeRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  modePill: { flex: 1, paddingVertical: 10, alignItems: "center" },
  modePillText: { fontSize: 14, fontFamily: "Montserrat_600SemiBold" },
  modeHint: {
    fontSize: 12,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 16,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    marginBottom: 12,
    fontFamily: "PlayfairDisplay_600SemiBold",
  },
  modalOption: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: "Montserrat_400Regular",
  },
});
