import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

interface EventHeroImageProps {
  uri?: string | null;
  backgroundColor: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  bleed?: number;
}

export function EventHeroImage({
  uri,
  backgroundColor,
  children,
  style,
  borderRadius = 18,
  bleed = 4,
}: EventHeroImageProps) {
  return (
    <View style={[styles.container, { backgroundColor, borderRadius }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              top: -bleed,
              right: -bleed,
              bottom: -bleed,
              left: -bleed,
            },
          ]}
          resizeMode="cover"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
