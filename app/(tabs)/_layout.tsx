import { Tabs, router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

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
      <Tabs.Screen
        name="index"
        options={{
          title: "Events",
          tabBarLabel: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Library",
          tabBarLabel: "Library",
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarLabel: "Admin",
          tabBarButton: showAdmin ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          headerRight: () => (
            <Pressable
              onPress={async () => {
                await supabase.auth.signOut();
                router.replace("/(auth)");
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 12, paddingVertical: 8 })}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
