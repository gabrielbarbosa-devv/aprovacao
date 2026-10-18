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
      exam_targets: {
        Row: { id: string; user_id: string; exam_name: string; institution: string; role_title: string; jurisdiction: string; current_stage: string; priority: string; exam_date: string | null; application_deadline: string | null; official_url: string | null; notes: string | null; archived_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; exam_name: string; institution: string; role_title: string; jurisdiction: string; current_stage?: string; priority?: string; exam_date?: string | null; application_deadline?: string | null; official_url?: string | null; notes?: string | null; archived_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; exam_name?: string; institution?: string; role_title?: string; jurisdiction?: string; current_stage?: string; priority?: string; exam_date?: string | null; application_deadline?: string | null; official_url?: string | null; notes?: string | null; archived_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      exam_subjects: {
        Row: { id: string; user_id: string; exam_target_id: string; subject_id: string; importance: string | null; official_question_weight: number | null; source_url: string | null; created_at: string }
        Insert: { id?: string; user_id: string; exam_target_id: string; subject_id: string; importance?: string | null; official_question_weight?: number | null; source_url?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; exam_target_id?: string; subject_id?: string; importance?: string | null; official_question_weight?: number | null; source_url?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "exam_subjects_exam_target_id_user_id_fkey"; columns: ["exam_target_id", "user_id"]; isOneToOne: false; referencedRelation: "exam_targets"; referencedColumns: ["id", "user_id"] },
          { foreignKeyName: "exam_subjects_subject_id_user_id_fkey"; columns: ["subject_id", "user_id"]; isOneToOne: false; referencedRelation: "subjects"; referencedColumns: ["id", "user_id"] },
        ]
      }
      exam_topics: {
        Row: { id: string; user_id: string; exam_target_id: string; topic_id: string; created_at: string }
        Insert: { id?: string; user_id: string; exam_target_id: string; topic_id: string; created_at?: string }
        Update: { id?: string; user_id?: string; exam_target_id?: string; topic_id?: string; created_at?: string }
        Relationships: [
          { foreignKeyName: "exam_topics_exam_target_id_user_id_fkey"; columns: ["exam_target_id", "user_id"]; isOneToOne: false; referencedRelation: "exam_targets"; referencedColumns: ["id", "user_id"] },
          { foreignKeyName: "exam_topics_topic_id_user_id_fkey"; columns: ["topic_id", "user_id"]; isOneToOne: false; referencedRelation: "topics"; referencedColumns: ["id", "user_id"] },
        ]
      }
      study_sessions: {
        Row: { id: string; user_id: string; block_id: string | null; topic_id: string; operation_key: string; studied_on: string; duration_minutes: number; question_count: number; correct_count: number; notes: string | null; deleted_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; block_id?: string | null; topic_id: string; operation_key: string; studied_on: string; duration_minutes: number; question_count?: number; correct_count?: number; notes?: string | null; deleted_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; block_id?: string | null; topic_id?: string; operation_key?: string; studied_on?: string; duration_minutes?: number; question_count?: number; correct_count?: number; notes?: string | null; deleted_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "study_sessions_block_id_user_id_fkey"; columns: ["block_id", "user_id"]; isOneToOne: false; referencedRelation: "study_blocks"; referencedColumns: ["id", "user_id"] },
          { foreignKeyName: "study_sessions_topic_id_user_id_fkey"; columns: ["topic_id", "user_id"]; isOneToOne: false; referencedRelation: "topics"; referencedColumns: ["id", "user_id"] },
        ]
      }
      review_tasks: {
        Row: { id: string; user_id: string; study_session_id: string; topic_id: string; review_kind: string; interval_days: number; due_on: string; initial_due_on: string; status: string; completed_at: string | null; difficulty: number | null; notes: string | null; parent_review_id: string | null; reviewed_on: string | null; review_question_count: number | null; review_correct_count: number | null; review_notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; study_session_id: string; topic_id: string; review_kind?: string; interval_days: number; due_on: string; initial_due_on: string; status?: string; completed_at?: string | null; difficulty?: number | null; notes?: string | null; parent_review_id?: string | null; reviewed_on?: string | null; review_question_count?: number | null; review_correct_count?: number | null; review_notes?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; study_session_id?: string; topic_id?: string; review_kind?: string; interval_days?: number; due_on?: string; initial_due_on?: string; status?: string; completed_at?: string | null; difficulty?: number | null; notes?: string | null; parent_review_id?: string | null; reviewed_on?: string | null; review_question_count?: number | null; review_correct_count?: number | null; review_notes?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "review_tasks_study_session_id_user_id_fkey"; columns: ["study_session_id", "user_id"]; isOneToOne: false; referencedRelation: "study_sessions"; referencedColumns: ["id", "user_id"] },
          { foreignKeyName: "review_tasks_topic_id_user_id_fkey"; columns: ["topic_id", "user_id"]; isOneToOne: false; referencedRelation: "topics"; referencedColumns: ["id", "user_id"] },
          { foreignKeyName: "review_tasks_parent_review_id_user_id_fkey"; columns: ["parent_review_id", "user_id"]; isOneToOne: false; referencedRelation: "review_tasks"; referencedColumns: ["id", "user_id"] },
        ]
      }
      review_events: {
        Row: { id: string; user_id: string; review_task_id: string; action: string; old_due_on: string | null; new_due_on: string | null; notes: string | null; occurred_at: string }
        Insert: { id?: string; user_id: string; review_task_id: string; action: string; old_due_on?: string | null; new_due_on?: string | null; notes?: string | null; occurred_at?: string }
        Update: { id?: string; user_id?: string; review_task_id?: string; action?: string; old_due_on?: string | null; new_due_on?: string | null; notes?: string | null; occurred_at?: string }
        Relationships: [
          { foreignKeyName: "review_events_review_task_id_user_id_fkey"; columns: ["review_task_id", "user_id"]; isOneToOne: false; referencedRelation: "review_tasks"; referencedColumns: ["id", "user_id"] },
        ]
      }
      study_blocks: {
        Row: {
          created_at: string
          id: string
          moved_from_date: string | null
          pinned: boolean
          planned_date: string
          planned_minutes: number
          planned_start_time: string | null
          sort_order: number
          status: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moved_from_date?: string | null
          pinned?: boolean
          planned_date: string
          planned_minutes: number
          planned_start_time?: string | null
          sort_order?: number
          status?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moved_from_date?: string | null
          pinned?: boolean
          planned_date?: string
          planned_minutes?: number
          planned_start_time?: string | null
          sort_order?: number
          status?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_blocks_topic_id_user_id_fkey"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subjects: {
        Row: {
          archived_at: string | null
          color_token: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color_token?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color_token?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          archived_at: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          notes: string | null
          priority: string
          sort_order: number
          source_url: string | null
          status: string
          subject_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          priority?: string
          sort_order?: number
          source_url?: string | null
          status?: string
          subject_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          priority?: string
          sort_order?: number
          source_url?: string | null
          status?: string
          subject_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_user_id_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          daily_goal_minutes: number
          timezone: string
          updated_at: string
          user_id: string
          weekly_availability: Json
        }
        Insert: {
          created_at?: string
          daily_goal_minutes?: number
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_availability?: Json
        }
        Update: {
          created_at?: string
          daily_goal_minutes?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_availability?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_exam_target: { Args: { p_target_id: string | null; p_exam_name: string; p_institution: string; p_role_title: string; p_jurisdiction: string; p_current_stage: string; p_priority: string; p_exam_date: string | null; p_application_deadline: string | null; p_official_url: string | null; p_notes: string | null; p_subject_ids: string[]; p_topic_ids: string[] }; Returns: Json }
      archive_topic: {
        Args: { p_expected_open_blocks: number; p_topic_id: string }
        Returns: string
      }
      save_study_session: {
        Args: { p_session_id: string | null; p_operation_key: string | null; p_block_id: string | null; p_topic_id: string; p_studied_on: string; p_duration_minutes: number; p_question_count: number; p_correct_count: number; p_notes: string | null }
        Returns: Json
      }
      delete_study_session: { Args: { p_session_id: string }; Returns: string }
      complete_review_task: {
        Args: { p_review_id: string; p_reviewed_on: string; p_difficulty: number; p_schedule_reinforcement: boolean; p_question_count: number | null; p_correct_count: number | null; p_notes: string | null }
        Returns: Json
      }
      snooze_review_task: {
        Args: { p_review_id: string; p_new_due_on: string; p_reason: string | null }
        Returns: Json
      }
      archive_subject: {
        Args: { p_expected_future_blocks: number; p_subject_id: string }
        Returns: string
      }
      reorder_subjects: {
        Args: { p_subject_ids: string[] }
        Returns: string
      }
      apply_schedule_reorganization: {
        Args: { p_changes: Json; p_expected: Json }
        Returns: string
      }
      create_planned_study_block: {
        Args: {
          p_id: string
          p_planned_date: string
          p_planned_minutes: number
          p_planned_start_time?: string | null
          p_topic_id: string
        }
        Returns: string
      }
      create_starter_plan: { Args: { p_start_date: string }; Returns: string }
      reorder_topics: {
        Args: { p_subject_id: string; p_topic_ids: string[] }
        Returns: string
      }
      start_study_block: { Args: { p_block_id: string }; Returns: string }
      update_planned_study_block: {
        Args: {
          p_id: string
          p_planned_date: string
          p_planned_minutes: number
          p_planned_start_time: string | null
          p_status: string
          p_topic_id: string
        }
        Returns: string
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
    Enums: {},
  },
} as const
