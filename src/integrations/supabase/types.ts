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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          admin_id: string
          chat_id: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          admin_id: string
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          admin_id?: string
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      chat_participants: {
        Row: {
          chat_id: string
          id: string
          joined_at: string | null
          muted: boolean | null
          removed: boolean | null
          removed_at: string | null
          removed_by: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string | null
          muted?: boolean | null
          removed?: boolean | null
          removed_at?: string | null
          removed_by?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string | null
          muted?: boolean | null
          removed?: boolean | null
          removed_at?: string | null
          removed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reports: {
        Row: {
          admin_notes: string | null
          chat_id: string | null
          created_at: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          chat_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          chat_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          announcements_only: boolean | null
          announcements_set_at: string | null
          announcements_set_by: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          is_closed: boolean | null
          type: string
          updated_at: string | null
        }
        Insert: {
          announcements_only?: boolean | null
          announcements_set_at?: string | null
          announcements_set_by?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_closed?: boolean | null
          type: string
          updated_at?: string | null
        }
        Update: {
          announcements_only?: boolean | null
          announcements_set_at?: string | null
          announcements_set_by?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_closed?: boolean | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          paid_amount: number | null
          payment_status: string | null
          status: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          paid_amount?: number | null
          payment_status?: string | null
          status?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          paid_amount?: number | null
          payment_status?: string | null
          status?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_votes: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          vote: string
          votee_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          vote: string
          votee_id: string
          voter_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          vote?: string
          votee_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          gender_balance_target: number | null
          host_id: string | null
          id: string
          is_past_voting_open: boolean
          location_address: string | null
          location_name: string
          location_url: string | null
          max_capacity: number
          name: string
          reserved_new_spots: number
          status: string
          time: string
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          gender_balance_target?: number | null
          host_id?: string | null
          id?: string
          is_past_voting_open?: boolean
          location_address?: string | null
          location_name: string
          location_url?: string | null
          max_capacity?: number
          name: string
          reserved_new_spots?: number
          status?: string
          time: string
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          gender_balance_target?: number | null
          host_id?: string | null
          id?: string
          is_past_voting_open?: boolean
          location_address?: string | null
          location_name?: string
          location_url?: string | null
          max_capacity?: number
          name?: string
          reserved_new_spots?: number
          status?: string
          time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_announcement: boolean | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          is_system: boolean | null
          pinned_by: string | null
          read_by: string[] | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_announcement?: boolean | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          is_system?: boolean | null
          pinned_by?: string | null
          read_by?: string[] | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_announcement?: boolean | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          is_system?: boolean | null
          pinned_by?: string | null
          read_by?: string[] | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ref_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          id: string
          instagram: string | null
          interests: string[] | null
          last_seen: string | null
          last_tenure_grant_at: string | null
          occupation: string | null
          phone: string | null
          photos: string[] | null
          points: number | null
          profile_completion: number | null
          referral_cap_override: number | null
          referral_code: string | null
          referral_disabled: boolean | null
          region: string | null
          region_other: string | null
          role: string | null
          status: string | null
          subscription_status: string | null
          super_role: string | null
          suspended: boolean | null
          suspended_at: string | null
          suspended_by: string | null
          tiktok: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          instagram?: string | null
          interests?: string[] | null
          last_seen?: string | null
          last_tenure_grant_at?: string | null
          occupation?: string | null
          phone?: string | null
          photos?: string[] | null
          points?: number | null
          profile_completion?: number | null
          referral_cap_override?: number | null
          referral_code?: string | null
          referral_disabled?: boolean | null
          region?: string | null
          region_other?: string | null
          role?: string | null
          status?: string | null
          subscription_status?: string | null
          super_role?: string | null
          suspended?: boolean | null
          suspended_at?: string | null
          suspended_by?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          instagram?: string | null
          interests?: string[] | null
          last_seen?: string | null
          last_tenure_grant_at?: string | null
          occupation?: string | null
          phone?: string | null
          photos?: string[] | null
          points?: number | null
          profile_completion?: number | null
          referral_cap_override?: number | null
          referral_code?: string | null
          referral_disabled?: boolean | null
          region?: string | null
          region_other?: string | null
          role?: string | null
          status?: string | null
          subscription_status?: string | null
          super_role?: string | null
          suspended?: boolean | null
          suspended_at?: string | null
          suspended_by?: string | null
          tiktok?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          referred_email: string | null
          referred_phone: string | null
          referred_user_id: string | null
          referrer_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          referred_email?: string | null
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          referred_email?: string | null
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_id?: string
          status?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          cancel_at_period_end: boolean | null
          created_at: string | null
          currency: string | null
          current_period_end: string
          current_period_start: string
          id: string
          payment_method_last4: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_method_last4?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_method_last4?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_chat_stats: {
        Args: never
        Returns: {
          active_chats: number
          closed_chats: number
          total_chats: number
        }[]
      }
      admin_count_users: {
        Args: never
        Returns: {
          ambassadors: number
          guests: number
          members: number
          total: number
          veterans: number
        }[]
      }
      admin_event_stats: {
        Args: never
        Returns: {
          active_events: number
          past_events: number
          total_events: number
        }[]
      }
      admin_subscription_stats: {
        Args: never
        Returns: {
          active_free: number
          active_paid: number
          active_total: number
          cancelled_this_month: number
          monthly_revenue: number
        }[]
      }
      calculate_profile_completion: {
        Args: { p_user_id: string }
        Returns: number
      }
      count_events_this_month: { Args: { p_user_id: string }; Returns: number }
      count_referrals_this_month: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_vote_score: { Args: { p_user_id: string }; Returns: number }
      is_super_user: { Args: { p_user_id: string }; Returns: boolean }
      mark_past_events: { Args: never; Returns: undefined }
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
