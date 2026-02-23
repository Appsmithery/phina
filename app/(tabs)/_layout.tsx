import { Tabs } from "expo-router";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { member } = useSupabase();
  const theme = useTheme();
  const showAdmin = member?.is_admin === true;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Events", tabBarLabel: "Events" }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarLabel: "History" }} />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarLabel: "Admin",
          tabBarButton: showAdmin ? undefined : () => null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
    </Tabs>
  );
}
