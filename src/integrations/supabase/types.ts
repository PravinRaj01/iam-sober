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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      about_content: {
        Row: {
          content: string
          created_at: string
          id: string
          mode: string
          order_index: number
          section_title: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mode: string
          order_index?: number
          section_title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mode?: string
          order_index?: number
          section_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string | null
          credential_id: string | null
          credential_url: string | null
          date: string
          description: string
          featured: boolean | null
          id: string
          issuer: string
          name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          date: string
          description: string
          featured?: boolean | null
          id?: string
          issuer: string
          name: string
          order_index?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          date?: string
          description?: string
          featured?: boolean | null
          id?: string
          issuer?: string
          name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_content: {
        Row: {
          created_at: string | null
          email: string
          id: string
          location: string | null
          mode: string
          phone: string | null
          services: string[] | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          location?: string | null
          mode: string
          phone?: string | null
          services?: string[] | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          location?: string | null
          mode?: string
          phone?: string | null
          services?: string[] | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      education: {
        Row: {
          achievements: string[]
          created_at: string | null
          degree: string
          description: string
          id: string
          institution: string
          location: string
          order_index: number
          period: string
          updated_at: string | null
        }
        Insert: {
          achievements?: string[]
          created_at?: string | null
          degree: string
          description: string
          id?: string
          institution: string
          location: string
          order_index?: number
          period: string
          updated_at?: string | null
        }
        Update: {
          achievements?: string[]
          created_at?: string | null
          degree?: string
          description?: string
          id?: string
          institution?: string
          location?: string
          order_index?: number
          period?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      experiences: {
        Row: {
          achievements: string[] | null
          certificate_drive_id: string | null
          certificate_url: string | null
          company: string
          created_at: string | null
          date_type: string | null
          description: string
          event_date: string | null
          event_images: string[] | null
          experience_type: string | null
          id: string
          location: string
          mode: string
          order_index: number | null
          period: string
          role: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          achievements?: string[] | null
          certificate_drive_id?: string | null
          certificate_url?: string | null
          company: string
          created_at?: string | null
          date_type?: string | null
          description: string
          event_date?: string | null
          event_images?: string[] | null
          experience_type?: string | null
          id?: string
          location: string
          mode: string
          order_index?: number | null
          period: string
          role?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          achievements?: string[] | null
          certificate_drive_id?: string | null
          certificate_url?: string | null
          company?: string
          created_at?: string | null
          date_type?: string | null
          description?: string
          event_date?: string | null
          event_images?: string[] | null
          experience_type?: string | null
          id?: string
          location?: string
          mode?: string
          order_index?: number | null
          period?: string
          role?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string | null
          game_type: string
          id: string
          nickname: string
          score: number
        }
        Insert: {
          created_at?: string | null
          game_type: string
          id?: string
          nickname: string
          score: number
        }
        Update: {
          created_at?: string | null
          game_type?: string
          id?: string
          nickname?: string
          score?: number
        }
        Relationships: []
      }
      github_ticker: {
        Row: {
          created_at: string
          id: string
          mode: string
          text: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          text?: string
          updated_at?: string
          url?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          text?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      hero_content: {
        Row: {
          animated_titles: string[] | null
          animation_pause_duration: number | null
          animation_speed: number | null
          background_image_url: string | null
          created_at: string
          cta_link: string | null
          cta_text: string
          description: string
          gradient_overlay_opacity: number | null
          greeting: string
          id: string
          mode: string
          name: string
          order_index: number
          profile_photo_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          animated_titles?: string[] | null
          animation_pause_duration?: number | null
          animation_speed?: number | null
          background_image_url?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text: string
          description: string
          gradient_overlay_opacity?: number | null
          greeting: string
          id?: string
          mode: string
          name: string
          order_index?: number
          profile_photo_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          animated_titles?: string[] | null
          animation_pause_duration?: number | null
          animation_speed?: number | null
          background_image_url?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string
          description?: string
          gradient_overlay_opacity?: number | null
          greeting?: string
          id?: string
          mode?: string
          name?: string
          order_index?: number
          profile_photo_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_folders: {
        Row: {
          cover_image_drive_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          mode: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          cover_image_drive_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mode: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          cover_image_drive_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mode?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_image_folders: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          media_type: string | null
          name: string
          order_index: number | null
          project_id: string
          updated_at: string | null
          video_thumbnail: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          media_type?: string | null
          name: string
          order_index?: number | null
          project_id: string
          updated_at?: string | null
          video_thumbnail?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          media_type?: string | null
          name?: string
          order_index?: number | null
          project_id?: string
          updated_at?: string | null
          video_thumbnail?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_image_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          categories: string[] | null
          category: string
          created_at: string | null
          crop_landscape: Json | null
          crop_phone: Json | null
          crop_square: Json | null
          crop_tablet: Json | null
          description: string
          featured: boolean | null
          folder_id: string | null
          gallery_images: string[] | null
          github_url: string | null
          id: string
          image_drive_id: string | null
          image_home_drive_id: string | null
          image_scroll_enabled: boolean | null
          include_thumbnail_in_gallery: boolean | null
          is_active: boolean | null
          live_url: string | null
          mode: string
          order_index: number | null
          position: string | null
          positions: string[] | null
          project_date: string | null
          project_links: Json | null
          show_in_recent: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
          video_thumbnail_drive_id: string | null
          video_url: string | null
        }
        Insert: {
          categories?: string[] | null
          category: string
          created_at?: string | null
          crop_landscape?: Json | null
          crop_phone?: Json | null
          crop_square?: Json | null
          crop_tablet?: Json | null
          description: string
          featured?: boolean | null
          folder_id?: string | null
          gallery_images?: string[] | null
          github_url?: string | null
          id?: string
          image_drive_id?: string | null
          image_home_drive_id?: string | null
          image_scroll_enabled?: boolean | null
          include_thumbnail_in_gallery?: boolean | null
          is_active?: boolean | null
          live_url?: string | null
          mode: string
          order_index?: number | null
          position?: string | null
          positions?: string[] | null
          project_date?: string | null
          project_links?: Json | null
          show_in_recent?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          video_thumbnail_drive_id?: string | null
          video_url?: string | null
        }
        Update: {
          categories?: string[] | null
          category?: string
          created_at?: string | null
          crop_landscape?: Json | null
          crop_phone?: Json | null
          crop_square?: Json | null
          crop_tablet?: Json | null
          description?: string
          featured?: boolean | null
          folder_id?: string | null
          gallery_images?: string[] | null
          github_url?: string | null
          id?: string
          image_drive_id?: string | null
          image_home_drive_id?: string | null
          image_scroll_enabled?: boolean | null
          include_thumbnail_in_gallery?: boolean | null
          is_active?: boolean | null
          live_url?: string | null
          mode?: string
          order_index?: number | null
          position?: string | null
          positions?: string[] | null
          project_date?: string | null
          project_links?: Json | null
          show_in_recent?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          video_thumbnail_drive_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string
          features: string[]
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          features: string[]
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          features?: string[]
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          academic_default_view: string | null
          chatbot_default_state: string | null
          chatbot_enabled: boolean | null
          chatbot_name: string | null
          chatbot_welcome_message: string | null
          created_at: string
          creative_logo_url: string | null
          creative_mode_enabled: boolean | null
          creative_resume_url: string | null
          creative_site_name: string | null
          creative_visible_pages: string[] | null
          default_mode: string | null
          id: string
          logo_url: string | null
          mode_toggle_pages: string[] | null
          professional_logo_url: string | null
          professional_mode_enabled: boolean | null
          professional_resume_url: string | null
          professional_site_name: string | null
          professional_visible_pages: string[] | null
          projects_default_view: string | null
          resume_url: string | null
          show_daily_visitors: boolean | null
          show_total_visitors: boolean | null
          site_name: string
          updated_at: string
          visitor_counter_enabled: boolean | null
        }
        Insert: {
          academic_default_view?: string | null
          chatbot_default_state?: string | null
          chatbot_enabled?: boolean | null
          chatbot_name?: string | null
          chatbot_welcome_message?: string | null
          created_at?: string
          creative_logo_url?: string | null
          creative_mode_enabled?: boolean | null
          creative_resume_url?: string | null
          creative_site_name?: string | null
          creative_visible_pages?: string[] | null
          default_mode?: string | null
          id?: string
          logo_url?: string | null
          mode_toggle_pages?: string[] | null
          professional_logo_url?: string | null
          professional_mode_enabled?: boolean | null
          professional_resume_url?: string | null
          professional_site_name?: string | null
          professional_visible_pages?: string[] | null
          projects_default_view?: string | null
          resume_url?: string | null
          show_daily_visitors?: boolean | null
          show_total_visitors?: boolean | null
          site_name: string
          updated_at?: string
          visitor_counter_enabled?: boolean | null
        }
        Update: {
          academic_default_view?: string | null
          chatbot_default_state?: string | null
          chatbot_enabled?: boolean | null
          chatbot_name?: string | null
          chatbot_welcome_message?: string | null
          created_at?: string
          creative_logo_url?: string | null
          creative_mode_enabled?: boolean | null
          creative_resume_url?: string | null
          creative_site_name?: string | null
          creative_visible_pages?: string[] | null
          default_mode?: string | null
          id?: string
          logo_url?: string | null
          mode_toggle_pages?: string[] | null
          professional_logo_url?: string | null
          professional_mode_enabled?: boolean | null
          professional_resume_url?: string | null
          professional_site_name?: string | null
          professional_visible_pages?: string[] | null
          projects_default_view?: string | null
          resume_url?: string | null
          show_daily_visitors?: boolean | null
          show_total_visitors?: boolean | null
          site_name?: string
          updated_at?: string
          visitor_counter_enabled?: boolean | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string
          color: string
          created_at: string
          icon: string
          id: string
          mode: string
          order_index: number
          skills: string[]
          updated_at: string
        }
        Insert: {
          category: string
          color: string
          created_at?: string
          icon: string
          id?: string
          mode: string
          order_index?: number
          skills: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          mode?: string
          order_index?: number
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      socials: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          icon: string
          id: string
          mode: string
          name: string
          order_index: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          icon: string
          id?: string
          mode?: string
          name: string
          order_index?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          icon?: string
          id?: string
          mode?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      stats: {
        Row: {
          created_at: string
          id: string
          label: string
          mode: string
          order_index: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          mode: string
          order_index?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          mode?: string
          order_index?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      technical_skills: {
        Row: {
          category: string
          color: string | null
          created_at: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          position_x: number | null
          position_y: number | null
          position_z: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      visitor_daily_stats: {
        Row: {
          created_at: string
          date: string
          id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          view_count?: number
        }
        Relationships: []
      }
      visitor_stats: {
        Row: {
          id: string
          last_updated: string
          view_count: number
        }
        Insert: {
          id?: string
          last_updated?: string
          view_count?: number
        }
        Update: {
          id?: string
          last_updated?: string
          view_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      submit_game_score: {
        Args: { p_game_type: string; p_nickname: string; p_score: number }
        Returns: Json
      }
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
