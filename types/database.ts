export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      billing_customers: {
        Row: {
          member_id: string;
          stripe_customer_id: string | null;
          revenuecat_app_user_id: string | null;
          revenuecat_original_app_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          stripe_customer_id?: string | null;
          revenuecat_app_user_id?: string | null;
          revenuecat_original_app_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          stripe_customer_id?: string | null;
          revenuecat_app_user_id?: string | null;
          revenuecat_original_app_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_blocks: {
        Row: {
          blocker_id: string;
          blocked_member_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_member_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_member_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          avatar_url: string | null;
          avatar_storage_path: string | null;
          avatar_source: "google" | "upload" | "removed" | null;
          first_name: string | null;
          last_name: string | null;
          birthday: string | null;
          city: string | null;
          state: string | null;
          wine_experience:
            | "beginner"
            | "intermediate"
            | "advanced"
            | "professional"
            | null;
          profile_complete: boolean;
          push_token: string | null;
          phone: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          avatar_url?: string | null;
          avatar_storage_path?: string | null;
          avatar_source?: "google" | "upload" | "removed" | null;
          first_name?: string | null;
          last_name?: string | null;
          birthday?: string | null;
          city?: string | null;
          state?: string | null;
          wine_experience?:
            | "beginner"
            | "intermediate"
            | "advanced"
            | "professional"
            | null;
          profile_complete?: boolean;
          push_token?: string | null;
          phone?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          avatar_url?: string | null;
          avatar_storage_path?: string | null;
          avatar_source?: "google" | "upload" | "removed" | null;
          first_name?: string | null;
          last_name?: string | null;
          birthday?: string | null;
          city?: string | null;
          state?: string | null;
          wine_experience?:
            | "beginner"
            | "intermediate"
            | "advanced"
            | "professional"
            | null;
          profile_complete?: boolean;
          push_token?: string | null;
          phone?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          theme: string;
          date: string;
          starts_at: string;
          ends_at: string;
          timezone: string;
          default_rating_window_minutes: 5 | 10 | 15;
          status: "active" | "ended";
          tasting_mode: "single_blind" | "double_blind";
          created_by: string;
          created_at: string;
          web_link: string | null;
          description: string | null;
          event_image_url: string | null;
          event_image_status:
            | "none"
            | "pending"
            | "generated"
            | "uploaded"
            | "failed";
          event_image_source: "none" | "generated" | "uploaded";
        };
        Insert: {
          id?: string;
          title: string;
          theme: string;
          date: string;
          starts_at: string;
          ends_at: string;
          timezone?: string;
          default_rating_window_minutes?: 5 | 10 | 15;
          status?: "active" | "ended";
          tasting_mode?: "single_blind" | "double_blind";
          created_by: string;
          created_at?: string;
          web_link?: string | null;
          description?: string | null;
          event_image_url?: string | null;
          event_image_status?:
            | "none"
            | "pending"
            | "generated"
            | "uploaded"
            | "failed";
          event_image_source?: "none" | "generated" | "uploaded";
        };
        Update: {
          id?: string;
          title?: string;
          theme?: string;
          date?: string;
          starts_at?: string;
          ends_at?: string;
          timezone?: string;
          default_rating_window_minutes?: 5 | 10 | 15;
          status?: "active" | "ended";
          tasting_mode?: "single_blind" | "double_blind";
          created_by?: string;
          created_at?: string;
          web_link?: string | null;
          description?: string | null;
          event_image_url?: string | null;
          event_image_status?:
            | "none"
            | "pending"
            | "generated"
            | "uploaded"
            | "failed";
          event_image_source?: "none" | "generated" | "uploaded";
        };
        Relationships: [];
      };
      event_members: {
        Row: {
          event_id: string;
          member_id: string;
          checked_in: boolean;
        };
        Insert: {
          event_id: string;
          member_id: string;
          checked_in?: boolean;
        };
        Update: {
          event_id?: string;
          member_id?: string;
          checked_in?: boolean;
        };
        Relationships: [];
      };
      wines: {
        Row: {
          id: string;
          event_id: string | null;
          brought_by: string;
          producer: string | null;
          varietal: string | null;
          vintage: number | null;
          region: string | null;
          label_photo_url: string | null;
          ai_summary: string | null;
          quantity: number;
          color: "red" | "white" | "skin-contact" | null;
          is_sparkling: boolean;
          ai_geography: string | null;
          ai_production: string | null;
          ai_tasting_notes: string | null;
          ai_pairings: string | null;
          wine_attributes: {
            oak: "oaked" | "unoaked" | "stainless" | null;
            oak_intensity: "new" | "neutral" | null;
            climate: "cool" | "moderate" | "warm" | null;
            body_inferred: "light" | "medium" | "full" | null;
            tannin_inferred: "low" | "medium" | "high" | null;
            acidity_inferred: "low" | "medium" | "high" | null;
            style: "conventional" | "natural" | "biodynamic" | "organic" | null;
          } | null;
          price_range: string | null;
          price_cents: number | null;
          status: "storage" | "consumed";
          date_consumed: string | null;
          drink_from: number | null;
          drink_until: number | null;
          display_photo_url: string | null;
          image_confidence_score: number | null;
          image_generation_status:
            | "pending"
            | "generated"
            | "fallback_cleaned"
            | "fallback_raw"
            | "failed"
            | null;
          image_generation_metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string | null;
          brought_by: string;
          producer?: string | null;
          varietal?: string | null;
          vintage?: number | null;
          region?: string | null;
          label_photo_url?: string | null;
          ai_summary?: string | null;
          quantity?: number;
          color?: "red" | "white" | "skin-contact" | null;
          is_sparkling?: boolean;
          ai_geography?: string | null;
          ai_production?: string | null;
          ai_tasting_notes?: string | null;
          ai_pairings?: string | null;
          wine_attributes?: {
            oak: "oaked" | "unoaked" | "stainless" | null;
            oak_intensity: "new" | "neutral" | null;
            climate: "cool" | "moderate" | "warm" | null;
            body_inferred: "light" | "medium" | "full" | null;
            tannin_inferred: "low" | "medium" | "high" | null;
            acidity_inferred: "low" | "medium" | "high" | null;
            style: "conventional" | "natural" | "biodynamic" | "organic" | null;
          } | null;
          price_range?: string | null;
          price_cents?: number | null;
          status?: "storage" | "consumed";
          date_consumed?: string | null;
          drink_from?: number | null;
          drink_until?: number | null;
          display_photo_url?: string | null;
          image_confidence_score?: number | null;
          image_generation_status?:
            | "pending"
            | "generated"
            | "fallback_cleaned"
            | "fallback_raw"
            | "failed"
            | null;
          image_generation_metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          brought_by?: string;
          producer?: string | null;
          varietal?: string | null;
          vintage?: number | null;
          region?: string | null;
          label_photo_url?: string | null;
          ai_summary?: string | null;
          quantity?: number;
          color?: "red" | "white" | "skin-contact" | null;
          is_sparkling?: boolean;
          ai_geography?: string | null;
          ai_production?: string | null;
          ai_tasting_notes?: string | null;
          ai_pairings?: string | null;
          wine_attributes?: {
            oak: "oaked" | "unoaked" | "stainless" | null;
            oak_intensity: "new" | "neutral" | null;
            climate: "cool" | "moderate" | "warm" | null;
            body_inferred: "light" | "medium" | "full" | null;
            tannin_inferred: "low" | "medium" | "high" | null;
            acidity_inferred: "low" | "medium" | "high" | null;
            style: "conventional" | "natural" | "biodynamic" | "organic" | null;
          } | null;
          price_range?: string | null;
          price_cents?: number | null;
          status?: "storage" | "consumed";
          date_consumed?: string | null;
          drink_from?: number | null;
          drink_until?: number | null;
          display_photo_url?: string | null;
          image_confidence_score?: number | null;
          image_generation_status?:
            | "pending"
            | "generated"
            | "fallback_cleaned"
            | "fallback_raw"
            | "failed"
            | null;
          image_generation_metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      member_entitlements: {
        Row: {
          member_id: string;
          premium_active: boolean;
          source: "apple" | "stripe" | "admin" | "none";
          started_at: string | null;
          expires_at: string | null;
          original_transaction_ref: string | null;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          premium_active?: boolean;
          source?: "apple" | "stripe" | "admin" | "none";
          started_at?: string | null;
          expires_at?: string | null;
          original_transaction_ref?: string | null;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          premium_active?: boolean;
          source?: "apple" | "stripe" | "admin" | "none";
          started_at?: string | null;
          expires_at?: string | null;
          original_transaction_ref?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      host_credit_ledger: {
        Row: {
          id: string;
          member_id: string;
          delta: number;
          source:
            | "apple"
            | "stripe"
            | "admin"
            | "event_creation"
            | "adjustment";
          purchase_ref: string | null;
          event_id: string | null;
          metadata: Record<string, Json | undefined>;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          delta: number;
          source:
            | "apple"
            | "stripe"
            | "admin"
            | "event_creation"
            | "adjustment";
          purchase_ref?: string | null;
          event_id?: string | null;
          metadata?: Record<string, Json | undefined>;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          delta?: number;
          source?:
            | "apple"
            | "stripe"
            | "admin"
            | "event_creation"
            | "adjustment";
          purchase_ref?: string | null;
          event_id?: string | null;
          metadata?: Record<string, Json | undefined>;
          created_at?: string;
        };
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          provider: "stripe" | "revenuecat";
          event_id: string;
          payload: Json;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          provider: "stripe" | "revenuecat";
          event_id: string;
          payload: Json;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          provider?: "stripe" | "revenuecat";
          event_id?: string;
          payload?: Json;
          processed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          wine_id: string;
          member_id: string;
          value: -1 | 0 | 1;
          body: "light" | "medium" | "full" | null;
          sweetness: "dry" | "off-dry" | "sweet" | null;
          confidence: number | null;
          tags: string[];
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wine_id: string;
          member_id: string;
          value: -1 | 0 | 1;
          body?: "light" | "medium" | "full" | null;
          sweetness?: "dry" | "off-dry" | "sweet" | null;
          confidence?: number | null;
          tags?: string[];
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wine_id?: string;
          member_id?: string;
          value?: -1 | 0 | 1;
          body?: "light" | "medium" | "full" | null;
          sweetness?: "dry" | "off-dry" | "sweet" | null;
          confidence?: number | null;
          tags?: string[];
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_wine_id_fkey";
            columns: ["wine_id"];
            isOneToOne: false;
            referencedRelation: "wines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      image_generation_errors: {
        Row: {
          id: string;
          wine_id: string | null;
          event_id: string | null;
          error_type: string;
          error_details: Record<string, unknown> | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          wine_id?: string | null;
          event_id?: string | null;
          error_type: string;
          error_details?: Record<string, unknown> | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          wine_id?: string | null;
          event_id?: string | null;
          error_type?: string;
          error_details?: Record<string, unknown> | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      event_favorites: {
        Row: {
          event_id: string;
          member_id: string;
          wine_id: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          member_id: string;
          wine_id: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          member_id?: string;
          wine_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      rating_rounds: {
        Row: {
          id: string;
          event_id: string;
          wine_id: string;
          started_at: string;
          ended_at: string | null;
          is_active: boolean;
          duration_minutes: 5 | 10 | 15;
        };
        Insert: {
          id?: string;
          event_id: string;
          wine_id: string;
          started_at?: string;
          ended_at?: string | null;
          is_active?: boolean;
          duration_minutes?: 5 | 10 | 15;
        };
        Update: {
          id?: string;
          event_id?: string;
          wine_id?: string;
          started_at?: string;
          ended_at?: string | null;
          is_active?: boolean;
          duration_minutes?: 5 | 10 | 15;
        };
        Relationships: [];
      };
      user_feedback: {
        Row: {
          id: string;
          member_id: string;
          category:
            | "bug"
            | "feature_request"
            | "confusing"
            | "general_feedback"
            | "praise"
            | "report_user_content"
            | "report_ai_content";
          message: string;
          sentiment: "negative" | "neutral" | "positive" | null;
          source: string;
          screen: string;
          context_json: Json | null;
          wants_follow_up: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          category:
            | "bug"
            | "feature_request"
            | "confusing"
            | "general_feedback"
            | "praise"
            | "report_user_content"
            | "report_ai_content";
          message: string;
          sentiment?: "negative" | "neutral" | "positive" | null;
          source: string;
          screen: string;
          context_json?: Json | null;
          wants_follow_up?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          category?:
            | "bug"
            | "feature_request"
            | "confusing"
            | "general_feedback"
            | "praise"
            | "report_user_content"
            | "report_ai_content";
          message?: string;
          sentiment?: "negative" | "neutral" | "positive" | null;
          source?: string;
          screen?: string;
          context_json?: Json | null;
          wants_follow_up?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_feedback_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      wine_rating_summary: {
        Row: {
          wine_id: string;
          thumbs_up: number;
          meh: number;
          thumbs_down: number;
          total_votes: number;
        };
        Relationships: [];
      };
      wines_with_price_privacy: {
        Row: {
          id: string;
          event_id: string | null;
          brought_by: string;
          producer: string | null;
          varietal: string | null;
          vintage: number | null;
          region: string | null;
          label_photo_url: string | null;
          ai_summary: string | null;
          quantity: number;
          color: "red" | "white" | "skin-contact" | null;
          is_sparkling: boolean;
          ai_geography: string | null;
          ai_production: string | null;
          ai_tasting_notes: string | null;
          ai_pairings: string | null;
          wine_attributes: {
            oak: "oaked" | "unoaked" | "stainless" | null;
            oak_intensity: "new" | "neutral" | null;
            climate: "cool" | "moderate" | "warm" | null;
            body_inferred: "light" | "medium" | "full" | null;
            tannin_inferred: "low" | "medium" | "high" | null;
            acidity_inferred: "low" | "medium" | "high" | null;
            style: "conventional" | "natural" | "biodynamic" | "organic" | null;
          } | null;
          status: "storage" | "consumed";
          date_consumed: string | null;
          drink_from: number | null;
          drink_until: number | null;
          display_photo_url: string | null;
          image_confidence_score: number | null;
          image_generation_status:
            | "pending"
            | "generated"
            | "fallback_cleaned"
            | "fallback_raw"
            | "failed"
            | null;
          image_generation_metadata: Record<string, unknown> | null;
          created_at: string;
          price_range: string | null;
          price_cents: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_hosted_event: {
        Args: {
          p_title: string;
          p_theme: string;
          p_date: string;
          p_starts_at: string;
          p_ends_at: string;
          p_timezone: string;
          p_default_rating_window_minutes?: number;
          p_tasting_mode?: string;
          p_description?: string | null;
          p_web_link?: string | null;
          p_partiful_url?: string | null;
          p_event_image_url?: string | null;
          p_event_image_status?: string;
        };
        Returns: string;
      };
      get_my_billing_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          premium_active: boolean;
          premium_source: string;
          premium_expires_at: string | null;
          host_credit_balance: number;
        }[];
      };
      get_event_wine_ratings: {
        Args: { p_event_id: string };
        Returns: {
          wine_id: string;
          thumbs_up: number;
          meh: number;
          thumbs_down: number;
        }[];
      };
      get_event_wine_tag_summary: {
        Args: { p_event_id: string };
        Returns: { wine_id: string; tag: string; tag_count: number }[];
      };
      grant_host_credits: {
        Args: {
          p_member_id: string;
          p_quantity: number;
          p_reason?: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type BillingCustomer =
  Database["public"]["Tables"]["billing_customers"]["Row"];
export type MemberBlock = Database["public"]["Tables"]["member_blocks"]["Row"];
export type MemberEntitlement =
  Database["public"]["Tables"]["member_entitlements"]["Row"];
export type HostCreditLedgerEntry =
  Database["public"]["Tables"]["host_credit_ledger"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventMember = Database["public"]["Tables"]["event_members"]["Row"];
export type Wine = Database["public"]["Tables"]["wines"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type EventFavorite =
  Database["public"]["Tables"]["event_favorites"]["Row"];
export type RatingRound = Database["public"]["Tables"]["rating_rounds"]["Row"];
export type UserFeedback = Database["public"]["Tables"]["user_feedback"]["Row"];
export type WineRatingSummary =
  Database["public"]["Views"]["wine_rating_summary"]["Row"];
export type WineWithPricePrivacy =
  Database["public"]["Views"]["wines_with_price_privacy"]["Row"];
