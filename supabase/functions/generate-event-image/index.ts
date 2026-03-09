import * as jose from "npm:jose";
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
] as const;
const EVENT_IMAGES_BUCKET = "event-images";
const PROMPT_VERSION = "1.0";

const EVENT_BRAND_SCAFFOLD =
  "warm editorial photography, golden hour ambient lighting, elegant entertaining atmosphere, " +
  "rich textures, soft bokeh, heritage-luxury tone";

const EVENT_SCENE_CONSTRAINTS =
  "4:3 aspect ratio, optimized for mobile card display, inviting depth";

interface ReqBody {
  event_id?: string | null;
  title?: string | null;
  theme?: string | null;
  description?: string | null;
}

interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string;
  modelId: string;
}

interface ImageGenerationAttempt {
  modelId: string;
  message: string;
  retryable: boolean;
  latencyMs: number;
}

interface AdminClient {
  from(table: string): {
    insert(values: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
    };
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean }
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

function buildEventImagePrompt(title: string, theme: string | null, description: string | null): string {
  const normalizedTitle = sanitizePromptField(title, 100) ?? "Wine tasting";
  const normalizedTheme = sanitizePromptField(theme, 80);
  const normalizedDescription = sanitizePromptField(description, 220);
  const themeSentence = normalizedTheme ? `Theme: ${normalizedTheme}. ` : "";
  const descriptionSentence = normalizedDescription ? `Description: ${normalizedDescription}. ` : "";

  return (
    `Generate an elegant editorial photograph for a wine tasting event titled "${normalizedTitle}". ` +
    themeSentence +
    descriptionSentence +
    "Show an inviting, atmospheric wine event scene - think candlelit table settings, " +
    "curated wine glasses, warm ambient lighting, stylish venue details. " +
    `Style: ${EVENT_BRAND_SCAFFOLD}. Scene: ${EVENT_SCENE_CONSTRAINTS}. ` +
    "No text, no logos, no watermarks, no people's faces."
  );
}

function sanitizePromptField(value: string | null | undefined, maxLength: number): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("generate-event-image: SUPABASE_URL not set");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const issuer = Deno.env.get("SB_JWT_ISSUER") ?? `${supabaseUrl}/auth/v1`;
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);

  try {
    const jwks = jose.createRemoteJWKSet(jwksUrl);
    await jose.jwtVerify(token, jwks, { issuer });
    return null;
  } catch (error) {
    console.warn("generate-event-image: JWT verification failed", error);
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }
}

function getAdminClient(): AdminClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey) as AdminClient;
}

async function setEventStatus(
  eventId: string,
  values: { event_image_status: "failed" | "generated"; event_image_url?: string | null }
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) {
    console.error("generate-event-image: missing admin client while updating event", { eventId, values });
    return;
  }

  const { error } = await admin.from("events").update(values).eq("id", eventId);
  if (error) {
    console.error("generate-event-image: failed to update event row", { eventId, error: error.message, values });
  }
}

async function logError(eventId: string, errorType: string, details: Record<string, unknown>): Promise<void> {
  const admin = getAdminClient();
  if (!admin) {
    console.error("generate-event-image: missing admin client while logging error", { eventId, errorType });
    return;
  }

  const { error } = await admin.from("image_generation_errors").insert({
    event_id: eventId,
    error_type: errorType,
    error_details: details,
  });

  if (error) {
    console.error("generate-event-image: failed to log error", { eventId, errorType, error: error.message });
  }
}

function isRetryableImageModelFailure(status: number, message: string): boolean {
  if (status === 404) return true;
  const normalized = message.toLowerCase();
  return normalized.includes("not found") ||
    normalized.includes("not supported for generatecontent") ||
    normalized.includes("unsupported") ||
    normalized.includes("no image bytes returned");
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function geminiGenerateImageForModel(apiKey: string, modelId: string, prompt: string): Promise<GeneratedImage> {
  const response = await fetch(`${GEMINI_BASE}/models/${modelId}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0.6,
        imageConfig: { aspectRatio: "4:3" },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const message = `Gemini image gen error ${response.status}: ${errorText.slice(0, 200)}`;
    const error = new Error(message) as Error & { retryable?: boolean; status?: number };
    error.retryable = isRetryableImageModelFailure(response.status, errorText);
    error.status = response.status;
    throw error;
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType: string; data: string } }>;
      };
    }>;
  };

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        bytes: base64ToUint8Array(part.inlineData.data),
        mimeType: part.inlineData.mimeType || "image/png",
        modelId,
      };
    }
  }

  const error = new Error("Gemini image gen error: no image bytes returned") as Error & { retryable?: boolean };
  error.retryable = true;
  throw error;
}

async function generateImageWithFallback(
  apiKey: string,
  prompt: string
): Promise<{ image: GeneratedImage | null; attempts: ImageGenerationAttempt[] }> {
  const attempts: ImageGenerationAttempt[] = [];

  for (const modelId of IMAGE_MODELS) {
    const startMs = Date.now();

    try {
      const image = await geminiGenerateImageForModel(apiKey, modelId, prompt);
      return { image, attempts };
    } catch (error) {
      const attemptError = error as Error & { retryable?: boolean };
      const attempt: ImageGenerationAttempt = {
        modelId,
        message: attemptError.message,
        retryable: attemptError.retryable === true,
        latencyMs: Date.now() - startMs,
      };
      attempts.push(attempt);
      console.warn(
        `generate-event-image: image generation failed for model=${modelId} retryable=${attempt.retryable} latency=${attempt.latencyMs}ms`,
        attempt.message
      );
      if (!attempt.retryable) break;
    }
  }

  return { image: null, attempts };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function uploadEventImage(eventId: string, image: GeneratedImage): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const path = `${eventId}/${crypto.randomUUID()}.${extensionForMimeType(image.mimeType)}`;
  const { data, error } = await admin.storage
    .from(EVENT_IMAGES_BUCKET)
    .upload(path, image.bytes, { contentType: image.mimeType, upsert: false });

  if (error || !data?.path) {
    console.error("generate-event-image: storage upload failed", error?.message ?? "missing path");
    return null;
  }

  const { data: urlData } = admin.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authError = await verifyAuth(req);
  if (authError) return authError;

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const eventId = body.event_id?.trim();
  const title = body.title?.trim();
  const theme = body.theme?.trim() ?? null;
  const description = body.description?.trim() ?? null;

  if (!eventId || !title) {
    return jsonResponse({ error: "event_id and title are required" }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("generate-event-image: GEMINI_API_KEY not configured");
    await setEventStatus(eventId, { event_image_status: "failed" });
    await logError(eventId, "missing_gemini_api_key", {});
    return jsonResponse({
      event_image_url: null,
      event_image_status: "failed",
      failure_reason: "missing_gemini_api_key",
      error: "GEMINI_API_KEY not configured",
    }, 200);
  }

  const startMs = Date.now();

  try {
    const prompt = buildEventImagePrompt(title, theme, description);
    const { image, attempts } = await generateImageWithFallback(apiKey, prompt);

    if (!image) {
      await setEventStatus(eventId, { event_image_status: "failed" });
      await logError(eventId, "image_generation_failed", {
        prompt_version: PROMPT_VERSION,
        attempts,
      });
      return jsonResponse({
        event_image_url: null,
        event_image_status: "failed",
        failure_reason: "image_generation_failed",
        error: attempts[attempts.length - 1]?.message ?? "Hero image generation failed.",
        metadata: {
          model_id: attempts[attempts.length - 1]?.modelId ?? IMAGE_MODELS[0],
          prompt_version: PROMPT_VERSION,
          latency_ms: Date.now() - startMs,
          image_generation_attempts: attempts.map((attempt) => ({
            model_id: attempt.modelId,
            latency_ms: attempt.latencyMs,
            retryable: attempt.retryable,
            message: attempt.message,
          })),
        },
      });
    }

    const publicUrl = await uploadEventImage(eventId, image);
    if (!publicUrl) {
      await setEventStatus(eventId, { event_image_status: "failed" });
      await logError(eventId, "storage_upload_failed", {
        model_id: image.modelId,
        mime_type: image.mimeType,
      });
      return jsonResponse({
        event_image_url: null,
        event_image_status: "failed",
        failure_reason: "storage_upload_failed",
        error: "Could not upload the generated hero image.",
        metadata: {
          model_id: image.modelId,
          prompt_version: PROMPT_VERSION,
          latency_ms: Date.now() - startMs,
          image_generation_attempts: attempts.map((attempt) => ({
            model_id: attempt.modelId,
            latency_ms: attempt.latencyMs,
            retryable: attempt.retryable,
            message: attempt.message,
          })),
        },
      });
    }

    await setEventStatus(eventId, {
      event_image_status: "generated",
      event_image_url: publicUrl,
    });

    return jsonResponse({
      event_image_url: publicUrl,
      event_image_status: "generated",
      metadata: {
        model_id: image.modelId,
        prompt_version: PROMPT_VERSION,
        latency_ms: Date.now() - startMs,
        image_generation_attempts: attempts.map((attempt) => ({
          model_id: attempt.modelId,
          latency_ms: attempt.latencyMs,
          retryable: attempt.retryable,
          message: attempt.message,
        })),
      },
    });
  } catch (error) {
    console.error("generate-event-image: unhandled error", error);
    await setEventStatus(eventId, { event_image_status: "failed" });
    await logError(eventId, "unhandled_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({
      event_image_url: null,
      event_image_status: "failed",
      failure_reason: "unhandled_error",
      error: error instanceof Error ? error.message : "Unhandled event image generation error.",
      metadata: {
        model_id: IMAGE_MODELS[0],
        prompt_version: PROMPT_VERSION,
        latency_ms: Date.now() - startMs,
      },
    });
  }
});

function corsHeaders(): Record<string, string> {
  const origin = Deno.env.get("APP_URL") || "https://phina.appsmithery.co";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
