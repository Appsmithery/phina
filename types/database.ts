export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
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
          wine_experience: "beginner" | "intermediate" | "advanced" | "professional" | null;
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
          wine_experience?: "beginner" | "intermediate" | "advanced" | "professional" | null;
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
          wine_experience?: "beginner" | "intermediate" | "advanced" | "professional" | null;
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
          status: "active" | "ended";
          tasting_mode: "single_blind" | "double_blind";
          created_by: string;
          created_at: string;
          partiful_url: string | null;
          description: string | null;
          event_image_url: string | null;
          event_image_status: "none" | "pending" | "generated" | "failed";
        };
        Insert: {
          id?: string;
          title: string;
          theme: string;
          date: string;
          status?: "active" | "ended";
          tasting_mode?: "single_blind" | "double_blind";
          created_by: string;
          created_at?: string;
          partiful_url?: string | null;
          description?: string | null;
          event_image_url?: string | null;
          event_image_status?: "none" | "pending" | "generated" | "failed";
        };
        Update: {
          id?: string;
          title?: string;
          theme?: string;
          date?: string;
          status?: "active" | "ended";
          tasting_mode?: "single_blind" | "double_blind";
          created_by?: string;
          created_at?: string;
          partiful_url?: string | null;
          description?: string | null;
          event_image_url?: string | null;
          event_image_status?: "none" | "pending" | "generated" | "failed";
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
          image_generation_status: "pending" | "generated" | "fallback_cleaned" | "fallback_raw" | "failed" | null;
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
          image_generation_status?: "pending" | "generated" | "fallback_cleaned" | "fallback_raw" | "failed" | null;
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
          image_generation_status?: "pending" | "generated" | "fallback_cleaned" | "fallback_raw" | "failed" | null;
          image_generation_metadata?: Record<string, unknown> | null;
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
          }
        ];
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
        };
        Insert: {
          id?: string;
          event_id: string;
          wine_id: string;
          started_at?: string;
          ended_at?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          event_id?: string;
          wine_id?: string;
          started_at?: string;
          ended_at?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
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
          image_generation_status: "pending" | "generated" | "fallback_cleaned" | "fallback_raw" | "failed" | null;
          image_generation_metadata: Record<string, unknown> | null;
          created_at: string;
          price_range: string | null;
          price_cents: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_event_wine_ratings: {
        Args: { p_event_id: string };
        Returns: { wine_id: string; thumbs_up: number; meh: number; thumbs_down: number }[];
      };
      get_event_wine_tag_summary: {
        Args: { p_event_id: string };
        Returns: { wine_id: string; tag: string; tag_count: number }[];
      };
    };
    Enums: Record<string, never>;
  };
}

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventMember = Database["public"]["Tables"]["event_members"]["Row"];
export type Wine = Database["public"]["Tables"]["wines"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type EventFavorite = Database["public"]["Tables"]["event_favorites"]["Row"];
export type RatingRound = Database["public"]["Tables"]["rating_rounds"]["Row"];
export type WineRatingSummary = Database["public"]["Views"]["wine_rating_summary"]["Row"];
export type WineWithPricePrivacy = Database["public"]["Views"]["wines_with_price_privacy"]["Row"];
