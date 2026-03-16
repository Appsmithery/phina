import { createClient } from "npm:@supabase/supabase-js@2.99.0";

const APP_URL = Deno.env.get("APP_URL") ?? "https://phina.appsmithery.co";
const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = mustGetEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type DeleteAccountRequest = {
  confirm?: boolean;
};

function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: Json | Record<string, Json | undefined>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function extractStorageObject(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectPath = parsed.pathname.slice(markerIndex + marker.length);
    const segments = objectPath.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    return {
      bucket: decodeURIComponent(segments[0]),
      path: decodeURIComponent(segments.slice(1).join("/")),
    };
  } catch {
    return null;
  }
}

function addObjectPath(
  objectsByBucket: Map<string, Set<string>>,
  bucket: string,
  path: string | null | undefined
) {
  if (!path) return;
  const trimmedPath = path.trim();
  if (!trimmedPath) return;

  if (!objectsByBucket.has(bucket)) {
    objectsByBucket.set(bucket, new Set());
  }

  objectsByBucket.get(bucket)?.add(trimmedPath);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as DeleteAccountRequest;
  if (body.confirm !== true) {
    return jsonResponse({ error: "Deletion must be explicitly confirmed." }, 400);
  }

  const authedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userError } = await authedSupabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = userData.user.id;
  const objectsByBucket = new Map<string, Set<string>>();

  const { data: memberRow, error: memberError } = await adminSupabase
    .from("members")
    .select("avatar_storage_path")
    .eq("id", userId)
    .maybeSingle();

  if (memberError) {
    return jsonResponse({ error: "Could not load account data." }, 500);
  }

  addObjectPath(objectsByBucket, "avatars", memberRow?.avatar_storage_path);

  const { data: wines, error: winesError } = await adminSupabase
    .from("wines")
    .select("label_photo_url, display_photo_url")
    .eq("brought_by", userId);

  if (winesError) {
    return jsonResponse({ error: "Could not load wine assets." }, 500);
  }

  for (const wine of wines ?? []) {
    const labelPhoto = extractStorageObject(wine.label_photo_url);
    const displayPhoto = extractStorageObject(wine.display_photo_url);
    if (labelPhoto) addObjectPath(objectsByBucket, labelPhoto.bucket, labelPhoto.path);
    if (displayPhoto) addObjectPath(objectsByBucket, displayPhoto.bucket, displayPhoto.path);
  }

  const { data: events, error: eventsError } = await adminSupabase
    .from("events")
    .select("event_image_url")
    .eq("created_by", userId);

  if (eventsError) {
    return jsonResponse({ error: "Could not load event assets." }, 500);
  }

  for (const event of events ?? []) {
    const eventImage = extractStorageObject(event.event_image_url);
    if (eventImage) addObjectPath(objectsByBucket, eventImage.bucket, eventImage.path);
  }

  for (const [bucket, objectPaths] of objectsByBucket.entries()) {
    const paths = [...objectPaths];
    if (paths.length === 0) continue;

    const { error } = await adminSupabase.storage.from(bucket).remove(paths);
    if (error) {
      console.warn(`delete-account: failed to remove ${bucket} objects`, error.message);
    }
  }

  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonResponse({ error: "Could not delete your account." }, 500);
  }

  return jsonResponse({ ok: true });
});
