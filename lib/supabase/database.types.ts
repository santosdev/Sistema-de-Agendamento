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
      availability_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          host_id: string
          id: string
          is_seed: boolean
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          host_id: string
          id?: string
          is_seed?: boolean
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          host_id?: string
          id?: string
          is_seed?: boolean
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          end_time: string
          host_id: string
          id: string
          is_seed: boolean
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          host_id: string
          id?: string
          is_seed?: boolean
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          host_id?: string
          id?: string
          is_seed?: boolean
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          anonymized_at: string | null
          answers: Json
          blocked_from: string
          blocked_until: string
          buffer_after_minutes: number
          buffer_before_minutes: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: Database["public"]["Enums"]["booking_actor"] | null
          created_at: string
          end_at: string
          event_title: string
          event_type_id: string
          guest_email: string
          guest_name: string
          guest_phone: string | null
          guest_time_zone: string
          host_id: string
          ics_sequence: number
          id: string
          is_seed: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          location_value: string | null
          manage_token_hash: string
          phone_mode: Database["public"]["Enums"]["phone_mode"] | null
          previous_start_at: string | null
          reschedule_count: number
          rescheduled_at: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          answers?: Json
          blocked_from: string
          blocked_until: string
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: Database["public"]["Enums"]["booking_actor"] | null
          created_at?: string
          end_at: string
          event_title: string
          event_type_id: string
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          guest_time_zone: string
          host_id: string
          ics_sequence?: number
          id?: string
          is_seed?: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          location_value?: string | null
          manage_token_hash: string
          phone_mode?: Database["public"]["Enums"]["phone_mode"] | null
          previous_start_at?: string | null
          reschedule_count?: number
          rescheduled_at?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          answers?: Json
          blocked_from?: string
          blocked_until?: string
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: Database["public"]["Enums"]["booking_actor"] | null
          created_at?: string
          end_at?: string
          event_title?: string
          event_type_id?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          guest_time_zone?: string
          host_id?: string
          ics_sequence?: number
          id?: string
          is_seed?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          location_value?: string | null
          manage_token_hash?: string
          phone_mode?: Database["public"]["Enums"]["phone_mode"] | null
          previous_start_at?: string | null
          reschedule_count?: number
          rescheduled_at?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          archived_at: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          color: Database["public"]["Enums"]["event_color"]
          created_at: string
          daily_limit: number | null
          description: string | null
          duration_minutes: number
          host_id: string
          id: string
          is_active: boolean
          is_seed: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          location_value: string | null
          max_days_ahead: number
          min_notice_minutes: number
          phone_mode: Database["public"]["Enums"]["phone_mode"] | null
          position: number
          questions: Json
          slot_interval_minutes: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          color?: Database["public"]["Enums"]["event_color"]
          created_at?: string
          daily_limit?: number | null
          description?: string | null
          duration_minutes?: number
          host_id: string
          id?: string
          is_active?: boolean
          is_seed?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          location_value?: string | null
          max_days_ahead?: number
          min_notice_minutes?: number
          phone_mode?: Database["public"]["Enums"]["phone_mode"] | null
          position?: number
          questions?: Json
          slot_interval_minutes?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          color?: Database["public"]["Enums"]["event_color"]
          created_at?: string
          daily_limit?: number | null
          description?: string | null
          duration_minutes?: number
          host_id?: string
          id?: string
          is_active?: boolean
          is_seed?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          location_value?: string | null
          max_days_ahead?: number
          min_notice_minutes?: number
          phone_mode?: Database["public"]["Enums"]["phone_mode"] | null
          position?: number
          questions?: Json
          slot_interval_minutes?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          is_public: boolean
          is_seed: boolean
          time_zone: string
          updated_at: string
          username: string
          welcome_message: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          is_public?: boolean
          is_seed?: boolean
          time_zone?: string
          updated_at?: string
          username: string
          welcome_message?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_public?: boolean
          is_seed?: boolean
          time_zone?: string
          updated_at?: string
          username?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          created_at: string
          id: number
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _assert_bookable: {
        Args: {
          p_duration_minutes: number
          p_enforce_notice: boolean
          p_event: Database["public"]["Tables"]["event_types"]["Row"]
          p_ignore_booking_id: string
          p_start: string
          p_time_zone: string
        }
        Returns: undefined
      }
      _build_answers: {
        Args: { p_answers: Json; p_questions: Json }
        Returns: Json
      }
      _demo_business_day: {
        Args: { p_base: string; p_offset: number }
        Returns: string
      }
      _fits_availability: {
        Args: {
          p_end: string
          p_host_id: string
          p_start: string
          p_step_minutes: number
          p_time_zone: string
        }
        Returns: boolean
      }
      _hash_manage_token: { Args: { p_token: string }; Returns: string }
      _lock_host: { Args: { p_host_id: string }; Returns: undefined }
      _new_manage_token: { Args: never; Returns: Record<string, unknown> }
      cancel_booking_by_token: {
        Args: { p_reason?: string; p_token: string }
        Returns: {
          booking_id: string
          ics_sequence: number
        }[]
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      create_booking: {
        Args: {
          p_answers: Json
          p_event_type_id: string
          p_guest_email: string
          p_guest_name: string
          p_guest_phone: string
          p_guest_time_zone: string
          p_start_at: string
        }
        Returns: {
          booking_id: string
          end_at: string
          manage_token: string
          start_at: string
        }[]
      }
      get_booking_by_token: {
        Args: { p_token: string }
        Returns: {
          booking_id: string
          can_modify: boolean
          cancel_reason: string
          cancelled_by: Database["public"]["Enums"]["booking_actor"]
          end_at: string
          event_color: Database["public"]["Enums"]["event_color"]
          event_slug: string
          event_title: string
          event_type_id: string
          guest_email: string
          guest_name: string
          guest_time_zone: string
          host_avatar_path: string
          host_display_name: string
          host_id: string
          host_time_zone: string
          host_username: string
          ics_sequence: number
          location_type: Database["public"]["Enums"]["location_type"]
          location_value: string
          modify_deadline: string
          phone_mode: Database["public"]["Enums"]["phone_mode"]
          previous_start_at: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      get_busy_ranges: {
        Args: { p_from: string; p_host_id: string; p_to: string }
        Returns: {
          blocked_from: string
          blocked_until: string
          end_at: string
          event_type_id: string
          start_at: string
        }[]
      }
      host_cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          booking_id: string
          ics_sequence: number
        }[]
      }
      host_reschedule_booking: {
        Args: { p_booking_id: string; p_new_start_at: string }
        Returns: {
          booking_id: string
          end_at: string
          ics_sequence: number
          previous_start_at: string
          start_at: string
        }[]
      }
      is_public_host: { Args: { p_host_id: string }; Returns: boolean }
      is_reserved_username: { Args: { value: string }; Returns: boolean }
      is_valid_questions: { Args: { questions: Json }; Returns: boolean }
      is_valid_time_zone: { Args: { tz: string }; Returns: boolean }
      reschedule_booking_by_token: {
        Args: { p_new_start_at: string; p_token: string }
        Returns: {
          booking_id: string
          end_at: string
          ics_sequence: number
          previous_start_at: string
          start_at: string
        }[]
      }
      run_maintenance: { Args: never; Returns: number }
      seed_demo: { Args: { p_host_id: string }; Returns: undefined }
    }
    Enums: {
      booking_actor: "guest" | "host"
      booking_status: "confirmed" | "rescheduled" | "cancelled"
      event_color:
        | "violet"
        | "blue"
        | "teal"
        | "green"
        | "amber"
        | "rose"
        | "fuchsia"
        | "slate"
      location_type:
        | "google_meet"
        | "zoom"
        | "phone"
        | "in_person"
        | "custom_link"
      phone_mode: "host_calls" | "guest_calls"
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
      booking_actor: ["guest", "host"],
      booking_status: ["confirmed", "rescheduled", "cancelled"],
      event_color: [
        "violet",
        "blue",
        "teal",
        "green",
        "amber",
        "rose",
        "fuchsia",
        "slate",
      ],
      location_type: [
        "google_meet",
        "zoom",
        "phone",
        "in_person",
        "custom_link",
      ],
      phone_mode: ["host_calls", "guest_calls"],
    },
  },
} as const
