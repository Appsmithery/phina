import { Stack } from "expo-router";

const headerOptions = {
  headerShown: false,
};

export default function AuthLayout() {
  return <Stack screenOptions={headerOptions} />;
}
