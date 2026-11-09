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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approved_quotes: {
        Row: {
          approved_at: string
          customer_id: string
          quote_id: string
          request_id: string
          snapshot: Json
        }
        Insert: {
          approved_at?: string
          customer_id: string
          quote_id: string
          request_id: string
          snapshot: Json
        }
        Update: {
          approved_at?: string
          customer_id?: string
          quote_id?: string
          request_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "approved_quotes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      commission_ledger: {
        Row: {
          base_cents: number
          created_at: string
          fee_cents: number
          id: string
          provider_id: string
          request_id: string
          version_id: string
        }
        Insert: {
          base_cents: number
          created_at?: string
          fee_cents: number
          id?: string
          provider_id: string
          request_id: string
          version_id: string
        }
        Update: {
          base_cents?: number
          created_at?: string
          fee_cents?: number
          id?: string
          provider_id?: string
          request_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "commission_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_versions: {
        Row: {
          base_definition: string | null
          created_at: string
          id: string
          legal_approved: boolean
          rate_bps: number
        }
        Insert: {
          base_definition?: string | null
          created_at?: string
          id?: string
          legal_approved?: boolean
          rate_bps?: number
        }
        Update: {
          base_definition?: string | null
          created_at?: string
          id?: string
          legal_approved?: boolean
          rate_bps?: number
        }
        Relationships: []
      }
      completion_confirmations: {
        Row: {
          confirmed_at: string
          final_amount_cents: number | null
          payment_method: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          final_amount_cents?: number | null
          payment_method?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          final_amount_cents?: number | null
          payment_method?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_confirmations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          privacy_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          privacy_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          privacy_version?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          name: string
        }
        Insert: {
          enabled?: boolean
          name: string
        }
        Update: {
          enabled?: boolean
          name?: string
        }
        Relationships: []
      }
      fee_notices: {
        Row: {
          dispute_note: string | null
          disputed: boolean
          disputed_at: string | null
          due_at: string
          final_notice_at: string | null
          id: string
          ledger_id: string
          notice_at: string
        }
        Insert: {
          dispute_note?: string | null
          disputed?: boolean
          disputed_at?: string | null
          due_at: string
          final_notice_at?: string | null
          id?: string
          ledger_id: string
          notice_at?: string
        }
        Update: {
          dispute_note?: string | null
          disputed?: boolean
          disputed_at?: string | null
          due_at?: string
          final_notice_at?: string | null
          id?: string
          ledger_id?: string
          notice_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_notices_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "commission_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_documents: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      provider_profiles: {
        Row: {
          application_accepted_at: string | null
          application_privacy_version: string | null
          application_status: string
          area: string
          availability: string
          business_name: string
          category: string
          contact_email: string
          identity_status: string
          qualification_summary: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string
          trade_status: string
          user_id: string
        }
        Insert: {
          application_accepted_at?: string | null
          application_privacy_version?: string | null
          application_status?: string
          area: string
          availability?: string
          business_name?: string
          category: string
          contact_email?: string
          identity_status?: string
          qualification_summary?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          trade_status?: string
          user_id: string
        }
        Update: {
          application_accepted_at?: string | null
          application_privacy_version?: string | null
          application_status?: string
          area?: string
          availability?: string
          business_name?: string
          category?: string
          contact_email?: string
          identity_status?: string
          qualification_summary?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          trade_status?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          assumptions: string
          callout_cents: number
          created_at: string
          id: string
          labour_cents: number
          parts_cents: number
          provider_id: string
          request_id: string
          scope: string
          timing: string
          total_cents: number | null
        }
        Insert: {
          assumptions: string
          callout_cents: number
          created_at?: string
          id?: string
          labour_cents: number
          parts_cents: number
          provider_id: string
          request_id: string
          scope: string
          timing: string
          total_cents?: number | null
        }
        Update: {
          assumptions?: string
          callout_cents?: number
          created_at?: string
          id?: string
          labour_cents?: number
          parts_cents?: number
          provider_id?: string
          request_id?: string
          scope?: string
          timing?: string
          total_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          note: string
          request_id: string
          status: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          note: string
          request_id: string
          status: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          note?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_private_details: {
        Row: {
          contact_phone: string
          customer_id: string
          request_id: string
          service_address: string
          shared_at: string
        }
        Insert: {
          contact_phone: string
          customer_id: string
          request_id: string
          service_address: string
          shared_at?: string
        }
        Update: {
          contact_phone?: string
          customer_id?: string
          request_id?: string
          service_address?: string
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_private_details_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_responses: {
        Row: {
          created_at: string
          decision: string
          id: string
          provider_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          provider_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          provider_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          area: string
          category: string
          city: string
          created_at: string
          customer_id: string
          description: string
          disputed_from_status: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          municipality: string
          status: string
          timing: string
          title: string
          updated_at: string
        }
        Insert: {
          area: string
          category: string
          city?: string
          created_at?: string
          customer_id: string
          description: string
          disputed_from_status?: string | null
          id?: string
          idempotency_key: string
          is_demo?: boolean
          municipality?: string
          status?: string
          timing: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          category?: string
          city?: string
          created_at?: string
          customer_id?: string
          description?: string
          disputed_from_status?: string | null
          id?: string
          idempotency_key?: string
          is_demo?: boolean
          municipality?: string
          status?: string
          timing?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_cases: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          opened_by: string
          request_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kind: string
          opened_by: string
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          opened_by?: string
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pilot_privacy: {
        Args: { p_name: string; p_phone?: string }
        Returns: undefined
      }
      calculate_commission: {
        Args: { p_base: number; p_bps: number }
        Returns: number
      }
      cancel_service_request: { Args: { p_id: string }; Returns: undefined }
      create_service_request: {
        Args: {
          p_area: string
          p_category: string
          p_description: string
          p_key: string
          p_timing: string
          p_title: string
        }
        Returns: string
      }
      has_consent: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      marketplace_create_request: {
        Args: {
          p_area: string
          p_category: string
          p_contact_phone: string
          p_description: string
          p_key: string
          p_service_address: string
          p_share_private_details: boolean
          p_timing: string
          p_title: string
        }
        Returns: string
      }
      marketplace_get_provider_contact: {
        Args: { p_request_id: string }
        Returns: {
          contact_phone: string
          service_address: string
        }[]
      }
      marketplace_is_open: { Args: never; Returns: boolean }
      marketplace_respond_to_request: {
        Args: { p_decision: string; p_request_id: string }
        Returns: undefined
      }
      provider_can_see_open: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      review_provider_application: {
        Args: {
          p_decision: string
          p_identity_status: string
          p_note: string
          p_provider_id: string
          p_trade_status: string
        }
        Returns: undefined
      }
      select_account_type: {
        Args: { p_account_type: string }
        Returns: undefined
      }
      submit_provider_application: {
        Args: {
          p_accept_privacy: boolean
          p_area: string
          p_availability: string
          p_business_name: string
          p_category: string
          p_qualification_summary: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "provider" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "provider", "admin"],
    },
  },
} as const
