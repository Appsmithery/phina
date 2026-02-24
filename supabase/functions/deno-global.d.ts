// Ambient types for Supabase Edge Functions (Deno runtime).
// The root tsconfig excludes supabase/functions; this file is used by
// supabase/functions/tsconfig.json so the IDE can type-check edge functions.

declare namespace Deno {
  export function serve(
    handler: (req: Request) => Promise<Response> | Response,
    options?: { port?: number; hostname?: string; onListen?: (params: { hostname: string; port: number }) => void }
  ): void;

  export const env: {
    get(key: string): string | undefined;
  };
}

// npm: specifiers are resolved by Deno at runtime; declare so TS accepts them.
declare module "npm:@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: { global?: { headers?: Record<string, string> } }
  ): unknown; // SupabaseClient at runtime
}

declare module "npm:@pushforge/builder@2" {
  export function buildPushHTTPRequest(options: {
    privateJWK: { kty: string; crv: string; x?: string; y?: string; d: string };
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    message: {
      payload: { title: string; body: string; data?: Record<string, string> };
      adminContact: string;
    };
  }): Promise<{ endpoint: string; headers: HeadersInit; body: string | ArrayBufferView }>;
}
