import type { ComponentProps } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface WineThumbnailImageProps {
  uri?: string | null;
  backgroundColor: string;
  iconColor: string;
  fallbackIconName?: IoniconName;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function WineThumbnailImage({
  uri,
  backgroundColor,
  iconColor,
  fallbackIconName = "wine-outline",
  iconSize = 20,
  style,
}: WineThumbnailImageProps) {
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <Ionicons name={fallbackIconName} size={iconSize} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 80,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
