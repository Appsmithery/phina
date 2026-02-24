import { Stack } from "expo-router";

const headerOptions = {
  headerShown: true,
  headerTitle: "",
  headerStyle: { backgroundColor: "#F2EFE9" },
  headerShadowVisible: false,
  headerTintColor: "#B58271",
  headerBackTitleVisible: false,
};

export default function AuthLayout() {
  return <Stack screenOptions={headerOptions} />;
}
