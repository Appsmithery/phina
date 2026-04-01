import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  blockMember,
  fetchBlockedMemberSummaries,
  fetchMemberBlocks,
  getBlockedMemberIdSet,
  unblockMember,
} from "@/lib/member-blocks";
import { useSupabase } from "@/lib/supabase-context";

function invalidateBlockedContentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["member-blocks"] }),
    queryClient.invalidateQueries({ queryKey: ["blocked-members"] }),
    queryClient.invalidateQueries({ queryKey: ["events"] }),
    queryClient.invalidateQueries({ queryKey: ["event"] }),
    queryClient.invalidateQueries({ queryKey: ["wines"] }),
    queryClient.invalidateQueries({ queryKey: ["wine"] }),
    queryClient.invalidateQueries({ queryKey: ["ratingRound"] }),
    queryClient.invalidateQueries({ queryKey: ["rating_rounds"] }),
    queryClient.invalidateQueries({ queryKey: ["event_rating_summary"] }),
    queryClient.invalidateQueries({ queryKey: ["eventWineRatings"] }),
    queryClient.invalidateQueries({ queryKey: ["eventWineTagSummary"] }),
  ]);
}

export function useMemberBlocks() {
  const { member, session } = useSupabase();
  const blockerId = session?.user?.id ?? member?.id ?? null;

  const query = useQuery({
    queryKey: ["member-blocks", blockerId],
    enabled: !!blockerId,
    queryFn: () => fetchMemberBlocks(blockerId!),
    placeholderData: [],
    staleTime: 60_000,
  });

  return {
    ...query,
    blockerId,
    blockedMemberIds: getBlockedMemberIdSet(query.data),
  };
}

export function useBlockedMembersList() {
  const { member, session } = useSupabase();
  const blockerId = session?.user?.id ?? member?.id ?? null;

  return useQuery({
    queryKey: ["blocked-members", blockerId],
    enabled: !!blockerId,
    queryFn: () => fetchBlockedMemberSummaries(blockerId!),
    placeholderData: [],
    staleTime: 60_000,
  });
}

export function useBlockMemberMutation() {
  const queryClient = useQueryClient();
  const { member, session } = useSupabase();
  const blockerId = session?.user?.id ?? member?.id ?? null;

  return useMutation({
    mutationFn: async (blockedMemberId: string) => {
      if (!blockerId) throw new Error("Sign in to block members.");
      await blockMember(blockerId, blockedMemberId);
    },
    onSuccess: async () => {
      await invalidateBlockedContentQueries(queryClient);
    },
  });
}

export function useUnblockMemberMutation() {
  const queryClient = useQueryClient();
  const { member, session } = useSupabase();
  const blockerId = session?.user?.id ?? member?.id ?? null;

  return useMutation({
    mutationFn: async (blockedMemberId: string) => {
      if (!blockerId) throw new Error("Sign in to unblock members.");
      await unblockMember(blockerId, blockedMemberId);
    },
    onSuccess: async () => {
      await invalidateBlockedContentQueries(queryClient);
    },
  });
}
