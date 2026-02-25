import { Stack } from "expo-router";
import { Image } from "react-native";

const headerOptions = {
  headerShown: true,
  headerTitle: () => (
    <Image 
      source={require("@/assets/phina_logo.png")} 
      style={{ height: 32, width: 120, resizeMode: "contain" }} 
    />
  ),
  headerStyle: { backgroundColor: "#F2EFE9" },
  headerShadowVisible: false,
  headerTintColor: "#B58271",
  headerBackTitleVisible: false,
};

export default function AuthLayout() {
  return <Stack screenOptions={headerOptions} />;
}
