export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      achievements: {
        Row: {
          id: string
          title: string
          description: string
          badge_name: string
          points: number
          category: string
          requirements: Json
        }
        Insert: {
          id?: string
          title: string
          description: string
          badge_name: string
          points: number
          category: string
          requirements: Json
        }
        Update: {
          id?: string
          title?: string
          description?: string
          badge_name?: string
          points?: number
          category?: string
          requirements?: Json
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          earned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          earned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          pseudonym: string
          addiction_type: string
          sobriety_start_date: string
          points: number
          level: number
          xp: number
          current_streak: number
          longest_streak: number
          last_check_in: string
        }
        Insert: {
          id: string
          pseudonym: string
          addiction_type: string
          sobriety_start_date: string
          points?: number
          level?: number
          xp?: number
          current_streak?: number
          longest_streak?: number
          last_check_in?: string
        }
        Update: {
          id?: string
          pseudonym?: string
          addiction_type?: string
          sobriety_start_date?: string
          points?: number
          level?: number
          xp?: number
          current_streak?: number
          longest_streak?: number
          last_check_in?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // ... existing tables ...
    }
  }
}