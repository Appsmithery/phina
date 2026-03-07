import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import {
  clampBirthdayToBounds,
  formatBirthday,
  formatBirthdayForStorage,
  getBirthdayYearOptions,
  getDefaultBirthday,
  getLatestAllowedBirthday,
  parseDateOnly,
  setBirthdayYear,
} from "@/lib/birthday";

type ThemeColors = {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
};

interface BirthdayPickerFieldProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  theme: ThemeColors;
  placeholder?: string;
  backgroundColor: string;
  hintText?: string;
}

const YEAR_ITEM_WIDTH = 88;

export function BirthdayPickerField({
  value,
  onChange,
  theme,
  placeholder = "Select your birthday",
  backgroundColor,
  hintText,
}: BirthdayPickerFieldProps) {
  const maximumDate = useMemo(() => getLatestAllowedBirthday(21), []);
  const yearOptions = useMemo(() => getBirthdayYearOptions(21, 120), []);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(() => clampBirthdayToBounds(value ?? getDefaultBirthday(maximumDate), maximumDate));
  const yearListRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    if (!modalVisible) {
      setDraftDate(clampBirthdayToBounds(value ?? getDefaultBirthday(maximumDate), maximumDate));
    }
  }, [maximumDate, modalVisible, value]);

  useEffect(() => {
    if (!modalVisible) return;
    const selectedYear = draftDate.getFullYear();
    const index = yearOptions.findIndex((year) => year === selectedYear);
    if (index >= 0) {
      requestAnimationFrame(() => {
        yearListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      });
    }
  }, [draftDate, modalVisible, yearOptions]);

  const commitDraftDate = () => {
    onChange(clampBirthdayToBounds(draftDate, maximumDate));
    setModalVisible(false);
  };

  const openAndroidCalendar = () => {
    DateTimePickerAndroid.open({
      value: draftDate,
      mode: "date",
      display: "calendar",
      maximumDate,
      onChange: (_event, selectedDate) => {
        if (selectedDate) {
          setDraftDate(clampBirthdayToBounds(selectedDate, maximumDate));
        }
      },
    });
  };

  const renderNativePicker = () => {
    if (Platform.OS === "ios") {
      return (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          onChange={(_event, selectedDate) => {
            if (selectedDate) {
              setDraftDate(clampBirthdayToBounds(selectedDate, maximumDate));
            }
          }}
          style={styles.iosPicker}
        />
      );
    }

    return (
      <TouchableOpacity
        style={[styles.androidCalendarButton, { borderColor: theme.border, backgroundColor: theme.background }]}
        onPress={openAndroidCalendar}
      >
        <Text style={[styles.androidCalendarLabel, { color: theme.text }]}>Choose month and day</Text>
        <Text style={[styles.androidCalendarValue, { color: theme.textMuted }]}>{formatBirthday(draftDate)}</Text>
      </TouchableOpacity>
    );
  };

  if (Platform.OS === "web") {
    return (
      <TextInput
        style={[styles.input, { backgroundColor, color: theme.text, borderColor: theme.border }]}
        placeholder="MM/DD/YYYY"
        placeholderTextColor={theme.textMuted}
        value={value ? formatBirthdayForStorage(value) : ""}
        onChange={(event: any) => {
          const nextValue = event?.target?.value || event?.nativeEvent?.text;
          const parsed = parseDateOnly(nextValue);
          if (parsed) {
            onChange(clampBirthdayToBounds(parsed, maximumDate));
          }
        }}
        // @ts-expect-error web-only prop
        type="date"
        max={formatBirthdayForStorage(maximumDate)}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.triggerButton, { backgroundColor, borderColor: theme.border }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.triggerText, { color: value ? theme.text : theme.textMuted }]}>
          {value ? formatBirthday(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalAction, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select birthday</Text>
              <TouchableOpacity onPress={commitDraftDate}>
                <Text style={[styles.modalAction, { color: theme.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.yearLabel, { color: theme.textMuted }]}>Year</Text>
            <FlatList
              ref={yearListRef}
              data={yearOptions}
              keyExtractor={(item) => String(item)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.yearList}
              getItemLayout={(_data, index) => ({
                length: YEAR_ITEM_WIDTH,
                offset: YEAR_ITEM_WIDTH * index,
                index,
              })}
              renderItem={({ item }) => {
                const selected = draftDate.getFullYear() === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.yearChip,
                      {
                        backgroundColor: selected ? theme.primary : theme.background,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setDraftDate((current) => setBirthdayYear(current, item, maximumDate))}
                  >
                    <Text style={[styles.yearChipText, { color: selected ? "#FFFFFF" : theme.text }]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <Text style={[styles.yearLabel, { color: theme.textMuted }]}>Month and day</Text>
            {renderNativePicker()}
            {hintText ? <Text style={[styles.hintText, { color: theme.textMuted }]}>{hintText}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  triggerButton: {
    justifyContent: "center",
  },
  triggerText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 16, 13, 0.28)",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalAction: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    minWidth: 56,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
  },
  yearLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  yearList: {
    paddingBottom: 16,
  },
  yearChip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginRight: 10,
    width: YEAR_ITEM_WIDTH - 10,
  },
  yearChipText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
  },
  iosPicker: {
    alignSelf: "stretch",
    marginHorizontal: -8,
  },
  androidCalendarButton: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  androidCalendarLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    marginBottom: 6,
  },
  androidCalendarValue: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
  },
  hintText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
