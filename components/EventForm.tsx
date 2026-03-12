import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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

import { useTheme } from "@/lib/theme";

export interface EventFormInitialValues {
  title: string;
  theme: string;
  description: string;
  webLink: string;
  date: string;
  tastingMode: "single_blind" | "double_blind";
}

export interface EventFormValues {
  title: string;
  theme: string;
  description: string | null;
  webLink: string | null;
  date: string;
  tastingMode: "single_blind" | "double_blind";
}

interface EventFormProps {
  heading: string;
  submitLabel: string;
  initialValues: EventFormInitialValues;
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

export function EventForm({
  heading,
  submitLabel,
  initialValues,
  isSubmitting = false,
  showHeading = true,
  minDate,
  tastingModeLocked = false,
  tastingModeLockedReason,
  onSubmit,
}: EventFormProps) {
  const theme = useTheme();
  const [title, setTitle] = useState(initialValues.title);
  const [themeText, setThemeText] = useState(initialValues.theme);
  const [description, setDescription] = useState(initialValues.description);
  const [webLink, setWebLink] = useState(initialValues.webLink);
  const [selectedDate, setSelectedDate] = useState(
    new Date(`${initialValues.date}T00:00:00`),
  );
  const [showPicker, setShowPicker] = useState(false);
  const [tastingMode, setTastingMode] = useState<
    "single_blind" | "double_blind"
  >(initialValues.tastingMode);

  useEffect(() => {
    setTitle(initialValues.title);
    setThemeText(initialValues.theme);
    setDescription(initialValues.description);
    setWebLink(initialValues.webLink);
    setSelectedDate(new Date(`${initialValues.date}T00:00:00`));
    setTastingMode(initialValues.tastingMode);
  }, [
    initialValues.date,
    initialValues.description,
    initialValues.webLink,
    initialValues.tastingMode,
    initialValues.theme,
    initialValues.title,
  ]);

  const date = selectedDate.toISOString().slice(0, 10);

  const onDateChange = (_event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (picked) setSelectedDate(picked);
  };

  const handleSubmit = () => {
    void onSubmit({
      title: title.trim(),
      theme: themeText.trim() || "Tasting",
      description: description.trim() || null,
      webLink: normalizeWebLink(webLink),
      date,
      tastingMode,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
                  const val = event?.target?.value;
                  if (val) setSelectedDate(new Date(`${val}T00:00:00`));
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
                  onPress={() => setShowPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDisplayDate(selectedDate)}
                  </Text>
                </TouchableOpacity>
                {showPicker ? (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                    minimumDate={minDate}
                    themeVariant="light"
                  />
                ) : null}
                {showPicker && Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={[
                      styles.doneButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => setShowPicker(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}

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
                      !active && { backgroundColor: "transparent" },
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
                  : "Guests see only wine numbers - details are revealed when the event ends."}
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
  doneButton: {
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
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
});
