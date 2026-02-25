export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          push_token: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          push_token?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          push_token?: string | null;
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
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          theme: string;
          date: string;
          status?: "active" | "ended";
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          theme?: string;
          date?: string;
          status?: "active" | "ended";
          created_by?: string;
          created_at?: string;
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
          ai_overview: string | null;
          ai_geography: string | null;
          ai_production: string | null;
          ai_tasting_notes: string | null;
          ai_pairings: string | null;
          price_range: string | null;
          price_cents: number | null;
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
          ai_overview?: string | null;
          ai_geography?: string | null;
          ai_production?: string | null;
          ai_tasting_notes?: string | null;
          ai_pairings?: string | null;
          price_range?: string | null;
          price_cents?: number | null;
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
          ai_overview?: string | null;
          ai_geography?: string | null;
          ai_production?: string | null;
          ai_tasting_notes?: string | null;
          ai_pairings?: string | null;
          price_range?: string | null;
          price_cents?: number | null;
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
          ai_overview: string | null;
          ai_geography: string | null;
          ai_production: string | null;
          ai_tasting_notes: string | null;
          ai_pairings: string | null;
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
