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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string | null
          description: string
          icon: string
          id: string
          requirements: Json
          title: string
          xp_reward: number
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          icon: string
          id?: string
          requirements: Json
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          requirements?: Json
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      ai_interventions: {
        Row: {
          acknowledged_at: string | null
          action_taken: string | null
          created_at: string
          id: string
          message: string
          risk_score: number | null
          suggested_actions: Json | null
          trigger_type: string
          user_id: string
          was_acknowledged: boolean | null
          was_helpful: boolean | null
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: string | null
          created_at?: string
          id?: string
          message: string
          risk_score?: number | null
          suggested_actions?: Json | null
          trigger_type: string
          user_id: string
          was_acknowledged?: boolean | null
          was_helpful?: boolean | null
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: string | null
          created_at?: string
          id?: string
          message?: string
          risk_score?: number | null
          suggested_actions?: Json | null
          trigger_type?: string
          user_id?: string
          was_acknowledged?: boolean | null
          was_helpful?: boolean | null
        }
        Relationships: []
      }
      ai_observability_logs: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          input_summary: string | null
          input_tokens: number | null
          intervention_triggered: boolean | null
          intervention_type: string | null
          model_used: string | null
          output_tokens: number | null
          response_summary: string | null
          response_time_ms: number | null
          tool_results: Json | null
          tools_called: Json | null
          user_feedback: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          input_summary?: string | null
          input_tokens?: number | null
          intervention_triggered?: boolean | null
          intervention_type?: string | null
          model_used?: string | null
          output_tokens?: number | null
          response_summary?: string | null
          response_time_ms?: number | null
          tool_results?: Json | null
          tools_called?: Json | null
          user_feedback?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          input_summary?: string | null
          input_tokens?: number | null
          intervention_triggered?: boolean | null
          intervention_type?: string | null
          model_used?: string | null
          output_tokens?: number | null
          response_summary?: string | null
          response_time_ms?: number | null
          tool_results?: Json | null
          tools_called?: Json | null
          user_feedback?: string | null
          user_id?: string
        }
        Relationships: []
      }
      biometric_logs: {
        Row: {
          blood_oxygen: number | null
          created_at: string
          heart_rate: number | null
          hrv: number | null
          id: string
          logged_at: string | null
          notes: string | null
          sleep_hours: number | null
          source: string | null
          steps: number | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          blood_oxygen?: number | null
          created_at?: string
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          logged_at?: string | null
          notes?: string | null
          sleep_hours?: number | null
          source?: string | null
          steps?: number | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          blood_oxygen?: number | null
          created_at?: string
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          logged_at?: string | null
          notes?: string | null
          sleep_hours?: number | null
          source?: string | null
          steps?: number | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          created_at: string
          id: string
          mood: string
          notes: string | null
          urge_intensity: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          notes?: string | null
          urge_intensity?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          notes?: string | null
          urge_intensity?: number | null
          user_id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          interaction_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interaction_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "community_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_interactions: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          id: string
          message: string | null
          type: string
          user_id: string
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          id?: string
          message?: string | null
          type: string
          user_id: string
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          id?: string
          message?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_community_interactions_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_community_interactions_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          interaction_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "community_interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coping_activities: {
        Row: {
          activity_name: string
          category: string
          created_at: string
          helpful: boolean | null
          id: string
          times_used: number | null
          user_id: string
        }
        Insert: {
          activity_name: string
          category: string
          created_at?: string
          helpful?: boolean | null
          id?: string
          times_used?: number | null
          user_id: string
        }
        Update: {
          activity_name?: string
          category?: string
          created_at?: string
          helpful?: boolean | null
          id?: string
          times_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      goal_completions: {
        Row: {
          completion_date: string
          created_at: string | null
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          completion_date: string
          created_at?: string | null
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          completion_date?: string
          created_at?: string | null
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_completions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed: boolean | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          progress: number | null
          start_date: string | null
          target_days: number | null
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          progress?: number | null
          start_date?: string | null
          target_days?: number | null
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          progress?: number | null
          start_date?: string | null
          target_days?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          sentiment: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sentiment?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sentiment?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      motivations: {
        Row: {
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      online_members: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          addiction_type: string | null
          background_image_url: string | null
          created_at: string
          current_streak: number | null
          id: string
          last_check_in: string | null
          level: number | null
          longest_streak: number | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          points: number | null
          privacy_settings: Json | null
          pseudonym: string | null
          sobriety_start_date: string
          updated_at: string
          xp: number | null
        }
        Insert: {
          addiction_type?: string | null
          background_image_url?: string | null
          created_at?: string
          current_streak?: number | null
          id: string
          last_check_in?: string | null
          level?: number | null
          longest_streak?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          points?: number | null
          privacy_settings?: Json | null
          pseudonym?: string | null
          sobriety_start_date?: string
          updated_at?: string
          xp?: number | null
        }
        Update: {
          addiction_type?: string | null
          background_image_url?: string | null
          created_at?: string
          current_streak?: number | null
          id?: string
          last_check_in?: string | null
          level?: number | null
          longest_streak?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          points?: number | null
          privacy_settings?: Json | null
          pseudonym?: string | null
          sobriety_start_date?: string
          updated_at?: string
          xp?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          created_at: string
          id: string
          prompt: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      relapses: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          relapse_date: string
          triggers: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          relapse_date?: string
          triggers?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          relapse_date?: string
          triggers?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      supporters: {
        Row: {
          access_level: string | null
          created_at: string
          id: string
          status: string | null
          supporter_email: string
          supporter_name: string | null
          user_id: string
        }
        Insert: {
          access_level?: string | null
          created_at?: string
          id?: string
          status?: string | null
          supporter_email: string
          supporter_name?: string | null
          user_id: string
        }
        Update: {
          access_level?: string | null
          created_at?: string
          id?: string
          status?: string | null
          supporter_email?: string
          supporter_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      triggers: {
        Row: {
          created_at: string
          id: string
          intensity: number | null
          location: string | null
          situation: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intensity?: number | null
          location?: string | null
          situation?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intensity?: number | null
          location?: string | null
          situation?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          created_at: string | null
          current_streak: number | null
          id: string | null
          level: number | null
          longest_streak: number | null
          pseudonym: string | null
          xp: number | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          id?: string | null
          level?: number | null
          longest_streak?: number | null
          pseudonym?: string | null
          xp?: number | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          id?: string | null
          level?: number | null
          longest_streak?: number | null
          pseudonym?: string | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_online_members: { Args: never; Returns: undefined }
      count_online_members: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_online_status: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
