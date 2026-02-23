import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/types/database";

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, email, is_admin").order("email");
      if (error) throw error;
      return data as Pick<Member, "id" | "name" | "email" | "is_admin">[];
    },
  });
}

export function useToggleAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) => {
      const { error } = await supabase.from("members").update({ is_admin: isAdmin }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
