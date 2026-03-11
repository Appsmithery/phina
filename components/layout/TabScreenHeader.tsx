import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getTabHeaderPadding, PAGE_HORIZONTAL_PADDING } from "@/lib/layout";
import { useTheme } from "@/lib/theme";

interface TabScreenHeaderProps {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function TabScreenHeader({ title, left, right }: TabScreenHeaderProps) {
  const theme = useTheme();
  const topInset = useSafeAreaInsets().top;

  return (
    <View style={[styles.header, { paddingTop: getTabHeaderPadding(topInset) }]}>
      <View style={styles.side}>{left ?? <View style={styles.sidePlaceholder} />}</View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={[styles.side, styles.sideRight]}>{right ?? <View style={styles.sidePlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  side: {
    minWidth: 64,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  sidePlaceholder: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    fontSize: 22,
    textAlign: "center",
    fontFamily: "PlayfairDisplay_700Bold",
  },
});
