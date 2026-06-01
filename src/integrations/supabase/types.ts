export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      collections_metadata: {
        Row: {
          banner_url: string | null
          contract_address: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string | null
          verified: boolean
        }
        Insert: {
          banner_url?: string | null
          contract_address: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          verified?: boolean
        }
        Update: {
          banner_url?: string | null
          contract_address?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      nft_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          token_id: number
          wallet_address: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          token_id: number
          wallet_address: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          token_id?: number
          wallet_address?: string
        }
        Relationships: []
      }
      nft_likes: {
        Row: {
          created_at: string
          id: string
          token_id: number
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          token_id: number
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          token_id?: number
          wallet_address?: string
        }
        Relationships: []
      }
      nft_offers: {
        Row: {
          amount_eth: number
          bidder_address: string
          created_at: string
          expires_at: string | null
          id: string
          message: string | null
          owner_address: string | null
          status: string
          token_id: number
          updated_at: string
        }
        Insert: {
          amount_eth: number
          bidder_address: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          owner_address?: string | null
          status?: string
          token_id: number
          updated_at?: string
        }
        Update: {
          amount_eth?: number
          bidder_address?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          owner_address?: string | null
          status?: string
          token_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      nft_views: {
        Row: {
          token_id: number
          updated_at: string
          view_count: number
        }
        Insert: {
          token_id: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          token_id?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          token_id: number | null
          type: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          token_id?: number | null
          type: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          token_id?: number | null
          type?: string
          wallet_address?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          twitter: string | null
          updated_at: string
          wallet_address: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          twitter?: string | null
          updated_at?: string
          wallet_address: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          twitter?: string | null
          updated_at?: string
          wallet_address?: string
          website?: string | null
        }
        Relationships: []
      }
      wallet_nonces: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          nonce: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          token_id: number
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          token_id: number
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          token_id?: number
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_nft_view: { Args: { p_token_id: number }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
