import { supabase } from "@/lib/supabase";
import type { Database, Member } from "@/types/database";

export type MemberBlock = Database["public"]["Tables"]["member_blocks"]["Row"];
export type BlockedMemberSummary = Pick<
  Member,
  "id" | "name" | "first_name" | "last_name" | "email"
> & {
  blocked_at: string;
};

type NamedMember = Pick<Member, "name" | "first_name" | "last_name" | "email">;

export function formatMemberLabel(member: NamedMember): string {
  const fullName = [member.first_name, member.last_name]
    .filter((part) => !!part?.trim())
    .join(" ")
    .trim();

  if (fullName) return fullName;
  if (member.name?.trim()) return member.name.trim();
  if (member.email?.trim()) return member.email.trim();
  return "Member";
}

export async function fetchMemberBlocks(blockerId: string): Promise<MemberBlock[]> {
  const { data, error } = await supabase
    .from("member_blocks")
    .select("blocker_id, blocked_member_id, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MemberBlock[];
}

export async function fetchBlockedMemberSummaries(
  blockerId: string,
): Promise<BlockedMemberSummary[]> {
  const blocks = await fetchMemberBlocks(blockerId);
  if (blocks.length === 0) return [];

  const blockedIds = blocks.map((block) => block.blocked_member_id);
  const { data, error } = await supabase
    .from("members")
    .select("id, name, first_name, last_name, email")
    .in("id", blockedIds);

  if (error) throw error;

  const membersById = new Map(
    ((data ?? []) as Pick<Member, "id" | "name" | "first_name" | "last_name" | "email">[])
      .map((member) => [member.id, member]),
  );

  return blocks
    .map((block) => {
      const blockedMember = membersById.get(block.blocked_member_id);
      if (!blockedMember) return null;

      return {
        ...blockedMember,
        blocked_at: block.created_at,
      } satisfies BlockedMemberSummary;
    })
    .filter((member): member is BlockedMemberSummary => member != null);
}

export async function blockMember(
  blockerId: string,
  blockedMemberId: string,
): Promise<void> {
  if (blockerId === blockedMemberId) {
    throw new Error("You can't block your own account.");
  }

  const { error } = await supabase
    .from("member_blocks")
    .upsert(
      {
        blocker_id: blockerId,
        blocked_member_id: blockedMemberId,
      },
      { onConflict: "blocker_id,blocked_member_id" },
    );

  if (error) throw error;
}

export async function unblockMember(
  blockerId: string,
  blockedMemberId: string,
): Promise<void> {
  const { error } = await supabase
    .from("member_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_member_id", blockedMemberId);

  if (error) throw error;
}

export function getBlockedMemberIdSet(
  blocks: Pick<MemberBlock, "blocked_member_id">[] | undefined,
): Set<string> {
  return new Set((blocks ?? []).map((block) => block.blocked_member_id));
}

export function isMemberBlocked(
  blockedMemberIds: Set<string>,
  memberId: string | null | undefined,
): boolean {
  return !!memberId && blockedMemberIds.has(memberId);
}

export function filterBlockedEvents<T extends { created_by: string | null }>(
  events: T[],
  blockedMemberIds: Set<string>,
): T[] {
  return events.filter((event) => !isMemberBlocked(blockedMemberIds, event.created_by));
}

export function filterBlockedWines<T extends { brought_by: string | null }>(
  wines: T[],
  blockedMemberIds: Set<string>,
): T[] {
  return wines.filter((wine) => !isMemberBlocked(blockedMemberIds, wine.brought_by));
}
