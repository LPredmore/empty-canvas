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
      agreement_item_links: {
        Row: {
          agreement_item_id: string | null
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string | null
        }
        Insert: {
          agreement_item_id?: string | null
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id?: string | null
        }
        Update: {
          agreement_item_id?: string | null
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_item_links_agreement_item_id_fkey"
            columns: ["agreement_item_id"]
            isOneToOne: false
            referencedRelation: "agreement_items"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_items: {
        Row: {
          agreement_id: string | null
          created_at: string
          full_text: string
          id: string
          is_active: boolean | null
          item_ref: string | null
          summary: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string
          full_text: string
          id?: string
          is_active?: boolean | null
          item_ref?: string | null
          summary?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          created_at?: string
          full_text?: string
          id?: string
          is_active?: boolean | null
          item_ref?: string | null
          summary?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_items_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_parties: {
        Row: {
          agreement_id: string
          person_id: string
          user_id: string | null
        }
        Insert: {
          agreement_id: string
          person_id: string
          user_id?: string | null
        }
        Update: {
          agreement_id?: string
          person_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_parties_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_parties_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          agreed_date: string | null
          created_at: string
          description: string | null
          id: string
          source_reference: string | null
          source_type: string
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          agreed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          source_reference?: string | null
          source_type: string
          status: string
          title: string
          user_id?: string | null
        }
        Update: {
          agreed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          source_reference?: string | null
          source_type?: string
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          assistant_session_id: string | null
          content: string
          created_at: string
          id: string
          linked_target_id: string | null
          linked_target_type: string | null
          sender_type: string
          user_id: string | null
        }
        Insert: {
          assistant_session_id?: string | null
          content: string
          created_at?: string
          id?: string
          linked_target_id?: string | null
          linked_target_type?: string | null
          sender_type: string
          user_id?: string | null
        }
        Update: {
          assistant_session_id?: string | null
          content?: string
          created_at?: string
          id?: string
          linked_target_id?: string | null
          linked_target_type?: string | null
          sender_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_assistant_session_id_fkey"
            columns: ["assistant_session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_sessions: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_analyses: {
        Row: {
          agreement_violations: Json | null
          conversation_id: string
          created_at: string
          id: string
          key_topics: Json | null
          message_annotations: Json | null
          overall_tone: string
          summary: string
          user_id: string | null
        }
        Insert: {
          agreement_violations?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          key_topics?: Json | null
          message_annotations?: Json | null
          overall_tone: string
          summary: string
          user_id?: string | null
        }
        Update: {
          agreement_violations?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          key_topics?: Json | null
          message_annotations?: Json | null
          overall_tone?: string
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_issue_links: {
        Row: {
          conversation_id: string
          created_at: string
          issue_id: string
          link_reason: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          issue_id: string
          link_reason?: string | null
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          issue_id?: string
          link_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          person_id: string
        }
        Insert: {
          conversation_id: string
          person_id: string
        }
        Update: {
          conversation_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ended_at: string | null
          id: string
          preview_text: string | null
          source_type: string
          started_at: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          preview_text?: string | null
          source_type: string
          started_at?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          preview_text?: string | null
          source_type?: string
          started_at?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_issues: {
        Row: {
          event_id: string
          issue_id: string
        }
        Insert: {
          event_id: string
          issue_id: string
        }
        Update: {
          event_id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_issues_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          date: string
          description: string | null
          id: string
          source_message_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          date: string
          description?: string | null
          id?: string
          source_message_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          date?: string
          description?: string | null
          id?: string
          source_message_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          description: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          priority: string
          status: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      legal_clause_links: {
        Row: {
          created_at: string
          id: string
          legal_clause_id: string | null
          target_id: string
          target_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          legal_clause_id?: string | null
          target_id: string
          target_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          legal_clause_id?: string | null
          target_id?: string
          target_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_clause_links_legal_clause_id_fkey"
            columns: ["legal_clause_id"]
            isOneToOne: false
            referencedRelation: "legal_clauses"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_clauses: {
        Row: {
          clause_ref: string
          created_at: string
          full_text: string
          id: string
          is_active: boolean | null
          legal_document_id: string | null
          summary: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          clause_ref: string
          created_at?: string
          full_text: string
          id?: string
          is_active?: boolean | null
          legal_document_id?: string | null
          summary?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          clause_ref?: string
          created_at?: string
          full_text?: string
          id?: string
          is_active?: boolean | null
          legal_document_id?: string | null
          summary?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_clauses_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          case_number: string | null
          court_name: string | null
          created_at: string
          document_type: string
          effective_date: string | null
          end_date: string | null
          file_url: string | null
          id: string
          jurisdiction: string | null
          notes: string | null
          signed_date: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          document_type: string
          effective_date?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          signed_date?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          document_type?: string
          effective_date?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          signed_date?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      message_issues: {
        Row: {
          issue_id: string
          message_id: string
        }
        Insert: {
          issue_id: string
          message_id: string
        }
        Update: {
          issue_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_issues_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_issues_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string | null
          direction: string
          id: string
          raw_text: string | null
          receiver_id: string | null
          sender_id: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          direction: string
          id?: string
          raw_text?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          direction?: string
          id?: string
          raw_text?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          role: string
          role_context: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          role: string
          role_context?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string
          role_context?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      person_relationships: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          person_id: string
          related_person_id: string
          relationship_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          person_id: string
          related_person_id: string
          relationship_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          person_id?: string
          related_person_id?: string
          relationship_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_relationships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_relationships_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          issue_id: string | null
          person_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          issue_id?: string | null
          person_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          issue_id?: string | null
          person_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_notes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_notes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
