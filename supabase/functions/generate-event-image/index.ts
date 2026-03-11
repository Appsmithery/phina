import * as jose from "npm:jose";
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODELS = [
  { id: "gemini-2.5-flash-image", aspectRatio: "4:3" },
  { id: "gemini-3.1-flash-image-preview", aspectRatio: "4:3" },
  { id: "gemini-2.0-flash-exp-image-generation" },
] as const;
const EVENT_IMAGES_BUCKET = "event-images";
const PROMPT_VERSION = "2.0";

const EVENT_IMAGE_PROMPT =
  "An archival photograph of a physical 16th-century Italian Renaissance fresco. " +
  "The scene is wine-themed — incorporate era-appropriate wine elements such as " +
  "terracotta jugs, blown-glass goblets, grapes, or vine leaves naturally into the composition. " +
  "Authentic degradation: matte chalky pigment, faded earth tones, chipped and aged " +
  "wall plaster, visible network of fine hairline cracks (craquelure). " +
  "Flat, ambient museum lighting with no artificial glow or digital sheen.";

interface ReqBody {
  event_id?: string | null;
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
  failureReason: string;
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

function buildEventImagePrompt(): string {
  return EVENT_IMAGE_PROMPT;
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

function normalizeImageModelFailure(status: number, message: string): {
  retryable: boolean;
  failureReason: string;
} {
  const normalized = message.toLowerCase();
  if (status === 429 || normalized.includes("resource_exhausted") || normalized.includes("rate limit")) {
    return { retryable: true, failureReason: "rate_limited" };
  }
  if ([500, 502, 503, 504].includes(status) || normalized.includes("unavailable") || normalized.includes("overloaded")) {
    return { retryable: true, failureReason: "provider_unavailable" };
  }
  if (status === 404 ||
    normalized.includes("not found") ||
    normalized.includes("not supported for generatecontent") ||
    normalized.includes("unsupported")) {
    return { retryable: true, failureReason: "model_unavailable" };
  }
  if (normalized.includes("no image bytes returned")) {
    return { retryable: true, failureReason: "empty_image_response" };
  }
  return { retryable: false, failureReason: "provider_error" };
}

function normalizeUserFacingError(failureReason: string): string {
  switch (failureReason) {
    case "rate_limited":
      return "Hero image generation is temporarily unavailable. Try again in a few minutes.";
    case "provider_unavailable":
      return "Hero image generation is temporarily unavailable. Try again shortly.";
    case "model_unavailable":
      return "Hero image generation is temporarily unavailable right now. Try again later.";
    case "storage_upload_failed":
      return "The hero image was generated but could not be saved. Try again.";
    case "missing_gemini_api_key":
      return "Hero image generation is not configured yet.";
    default:
      return "Hero image generation failed. Try again later.";
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  const modelConfig = IMAGE_MODELS.find((candidate) => candidate.id === modelId);
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE", "TEXT"],
    temperature: 0.8,
  };

  if (modelConfig?.aspectRatio) {
    generationConfig.imageConfig = { aspectRatio: modelConfig.aspectRatio };
  }

  const response = await fetch(`${GEMINI_BASE}/models/${modelId}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const message = `Gemini image gen error ${response.status}: ${errorText.slice(0, 200)}`;
    const { retryable, failureReason } = normalizeImageModelFailure(response.status, errorText);
    const error = new Error(message) as Error & { retryable?: boolean; status?: number; failureReason?: string };
    error.retryable = retryable;
    error.status = response.status;
    error.failureReason = failureReason;
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

  const error = new Error("Gemini image gen error: no image bytes returned") as Error & {
    retryable?: boolean;
    failureReason?: string;
  };
  error.retryable = true;
  error.failureReason = "empty_image_response";
  throw error;
}

async function generateImageWithFallback(
  apiKey: string,
  prompt: string
): Promise<{ image: GeneratedImage | null; attempts: ImageGenerationAttempt[] }> {
  const attempts: ImageGenerationAttempt[] = [];

  for (const { id: modelId } of IMAGE_MODELS) {
    const startMs = Date.now();

    try {
      const image = await geminiGenerateImageForModel(apiKey, modelId, prompt);
      return { image, attempts };
    } catch (error) {
      const attemptError = error as Error & { retryable?: boolean; failureReason?: string };
      const attempt: ImageGenerationAttempt = {
        modelId,
        message: attemptError.message,
        retryable: attemptError.retryable === true,
        latencyMs: Date.now() - startMs,
        failureReason: attemptError.failureReason ?? "provider_error",
      };
      attempts.push(attempt);
      console.warn(
        `generate-event-image: image generation failed for model=${modelId} retryable=${attempt.retryable} latency=${attempt.latencyMs}ms`,
        attempt.message
      );
      if (attempt.retryable) {
        await sleep(600);
      }
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

  if (!eventId) {
    return jsonResponse({ error: "event_id is required" }, 400);
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
    const prompt = buildEventImagePrompt();
    const { image, attempts } = await generateImageWithFallback(apiKey, prompt);

    if (!image) {
      await setEventStatus(eventId, { event_image_status: "failed" });
      await logError(eventId, "image_generation_failed", {
        prompt_version: PROMPT_VERSION,
        attempts,
      });
      const finalFailureReason = attempts[attempts.length - 1]?.failureReason ?? "provider_error";
      return jsonResponse({
        event_image_url: null,
        event_image_status: "failed",
        failure_reason: finalFailureReason,
        error: normalizeUserFacingError(finalFailureReason),
        metadata: {
          model_id: attempts[attempts.length - 1]?.modelId ?? IMAGE_MODELS[0].id,
          prompt_version: PROMPT_VERSION,
          latency_ms: Date.now() - startMs,
          image_generation_attempts: attempts.map((attempt) => ({
            model_id: attempt.modelId,
            latency_ms: attempt.latencyMs,
            retryable: attempt.retryable,
            message: attempt.message,
            failure_reason: attempt.failureReason,
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
        error: normalizeUserFacingError("storage_upload_failed"),
        metadata: {
          model_id: image.modelId,
          prompt_version: PROMPT_VERSION,
          latency_ms: Date.now() - startMs,
          image_generation_attempts: attempts.map((attempt) => ({
            model_id: attempt.modelId,
            latency_ms: attempt.latencyMs,
            retryable: attempt.retryable,
            message: attempt.message,
            failure_reason: attempt.failureReason,
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
          failure_reason: attempt.failureReason,
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
      error: normalizeUserFacingError("unhandled_error"),
      metadata: {
        model_id: IMAGE_MODELS[0].id,
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
