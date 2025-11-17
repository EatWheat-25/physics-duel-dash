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
      match_events: {
        Row: {
          created_at: string
          id: number
          match_id: string
          payload: Json | null
          sender: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: number
          match_id: string
          payload?: Json | null
          sender: string
          type: string
        }
        Update: {
          created_at?: string
          id?: number
          match_id?: string
          payload?: Json | null
          sender?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_with_names"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_sender_fkey"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_notifications: {
        Row: {
          created_at: string
          id: string
          match_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          user_id?: string
        }
        Relationships: []
      }
      match_questions: {
        Row: {
          match_id: string
          picked_at: string
          question_id: string
        }
        Insert: {
          match_id: string
          picked_at?: string
          question_id: string
        }
        Update: {
          match_id?: string
          picked_at?: string
          question_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_question_index: number | null
          id: string
          mode: string
          player1_id: string
          player1_score: number | null
          player2_id: string
          player2_score: number | null
          questions: Json
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          subject: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number | null
          id?: string
          mode: string
          player1_id: string
          player1_score?: number | null
          player2_id: string
          player2_score?: number | null
          questions: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          subject: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number | null
          id?: string
          mode?: string
          player1_id?: string
          player1_score?: number | null
          player2_id?: string
          player2_score?: number | null
          questions?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          subject?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      matches_new: {
        Row: {
          chapter: string
          created_at: string
          ended_at: string | null
          id: string
          p1: string
          p1_score: number | null
          p2: string
          p2_score: number | null
          state: string
          subject: string
          winner_id: string | null
        }
        Insert: {
          chapter: string
          created_at?: string
          ended_at?: string | null
          id?: string
          p1: string
          p1_score?: number | null
          p2: string
          p2_score?: number | null
          state?: string
          subject: string
          winner_id?: string | null
        }
        Update: {
          chapter?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          p1?: string
          p1_score?: number | null
          p2?: string
          p2_score?: number | null
          state?: string
          subject?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_new_p1_fkey"
            columns: ["p1"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_p2_fkey"
            columns: ["p2"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string | null
          id: string
          mode: string
          rank_tier: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mode: string
          rank_tier: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mode?: string
          rank_tier?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      player_actions: {
        Row: {
          answer: number
          created_at: string | null
          id: string
          is_correct: boolean
          marks_earned: number
          match_id: string
          question_index: number
          step_index: number
          user_id: string
        }
        Insert: {
          answer: number
          created_at?: string | null
          id?: string
          is_correct: boolean
          marks_earned: number
          match_id: string
          question_index: number
          step_index: number
          user_id: string
        }
        Update: {
          answer?: number
          created_at?: string | null
          id?: string
          is_correct?: boolean
          marks_earned?: number
          match_id?: string
          question_index?: number
          step_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          display_name: string
          id: string
          mmr: number
          region: string | null
          updated_at: string | null
        }
        Insert: {
          display_name: string
          id: string
          mmr?: number
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          mmr?: number
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string | null
          display_name: string | null
          id: string
          onboarding_completed: boolean | null
          subjects: Json
          updated_at: string | null
          username: string
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          display_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          subjects?: Json
          updated_at?: string | null
          username: string
        }
        Update: {
          age?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          subjects?: Json
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          chapter: string
          created_at: string | null
          difficulty: string
          id: string
          image_url: string | null
          level: string
          question_text: string
          rank_tier: string
          steps: Json
          subject: string
          title: string
          topic_tags: string[] | null
          total_marks: number
          updated_at: string | null
        }
        Insert: {
          chapter: string
          created_at?: string | null
          difficulty: string
          id?: string
          image_url?: string | null
          level: string
          question_text: string
          rank_tier?: string
          steps: Json
          subject: string
          title: string
          topic_tags?: string[] | null
          total_marks: number
          updated_at?: string | null
        }
        Update: {
          chapter?: string
          created_at?: string | null
          difficulty?: string
          id?: string
          image_url?: string | null
          level?: string
          question_text?: string
          rank_tier?: string
          steps?: Json
          subject?: string
          title?: string
          topic_tags?: string[] | null
          total_marks?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      queue: {
        Row: {
          chapter: string
          enqueued_at: string
          id: string
          last_heartbeat: string
          mmr: number
          player_id: string
          region: string | null
          subject: string
        }
        Insert: {
          chapter: string
          enqueued_at?: string
          id?: string
          last_heartbeat?: string
          mmr: number
          player_id: string
          region?: string | null
          subject: string
        }
        Update: {
          chapter?: string
          enqueued_at?: string
          id?: string
          last_heartbeat?: string
          mmr?: number
          player_id?: string
          region?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
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
      match_with_names: {
        Row: {
          created_at: string | null
          match_id: string | null
          p1: string | null
          p1_name: string | null
          p2: string | null
          p2_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_new_p1_fkey"
            columns: ["p1"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_p2_fkey"
            columns: ["p2"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pick_next_question_v2: {
        Args: { match_uuid: string }
        Returns: {
          chapter: string
          created_at: string | null
          difficulty: string
          id: string
          image_url: string | null
          level: string
          question_text: string
          rank_tier: string
          steps: Json
          subject: string
          title: string
          topic_tags: string[] | null
          total_marks: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_questions: { Args: { qrows: Json }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      match_status: "waiting" | "active" | "completed" | "abandoned"
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
      app_role: ["admin", "user"],
      match_status: ["waiting", "active", "completed", "abandoned"],
    },
  },
} as const
