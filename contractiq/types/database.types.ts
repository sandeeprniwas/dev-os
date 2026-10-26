// Mirrors docs/specs/supabase-schema.sql in the `supabase gen types typescript` format.
// Regenerate with `npm run db:types` after any schema change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          analyses_count: number
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          analyses_count?: number
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          analyses_count?: number
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          user_id: string
          title: string
          contract_type: Database['public']['Enums']['contract_type']
          detected_type: Database['public']['Enums']['detected_contract_type'] | null
          status: Database['public']['Enums']['contract_status']
          original_filename: string
          file_path: string | null
          file_size_bytes: number
          page_count: number
          word_count: number
          token_count: number
          contract_text: string
          prompt_version: string | null
          model: string | null
          processing_ms: number | null
          error_code: string | null
          error_message: string | null
          processed_at: string | null
          review_completed_at: string | null
          last_accessed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          contract_type: Database['public']['Enums']['contract_type']
          detected_type?: Database['public']['Enums']['detected_contract_type'] | null
          status?: Database['public']['Enums']['contract_status']
          original_filename: string
          file_path?: string | null
          file_size_bytes: number
          page_count: number
          word_count: number
          token_count: number
          contract_text: string
          prompt_version?: string | null
          model?: string | null
          processing_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          processed_at?: string | null
          review_completed_at?: string | null
          last_accessed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          contract_type?: Database['public']['Enums']['contract_type']
          detected_type?: Database['public']['Enums']['detected_contract_type'] | null
          status?: Database['public']['Enums']['contract_status']
          original_filename?: string
          file_path?: string | null
          file_size_bytes?: number
          page_count?: number
          word_count?: number
          token_count?: number
          contract_text?: string
          prompt_version?: string | null
          model?: string | null
          processing_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          processed_at?: string | null
          review_completed_at?: string | null
          last_accessed_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_key_terms: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          term_name: string
          is_manual: boolean
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          term_name: string
          is_manual?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          user_id?: string
          term_name?: string
          is_manual?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'custom_key_terms_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      key_terms: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          term_key: string
          term_name: string
          value: string | null
          original_value: string | null
          page_number: number | null
          confidence_score: number
          source_sentence: string | null
          source_verified: boolean
          is_custom: boolean
          is_edited: boolean
          edited_at: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          term_key: string
          term_name: string
          value?: string | null
          original_value?: string | null
          page_number?: number | null
          confidence_score: number
          source_sentence?: string | null
          source_verified?: boolean
          is_custom?: boolean
          is_edited?: boolean
          edited_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          user_id?: string
          term_key?: string
          term_name?: string
          value?: string | null
          original_value?: string | null
          page_number?: number | null
          confidence_score?: number
          source_sentence?: string | null
          source_verified?: boolean
          is_custom?: boolean
          is_edited?: boolean
          edited_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'key_terms_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      chat_sessions: {
        Row: {
          id: string
          contract_id: string
          user_id: string
          message_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          user_id: string
          message_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          user_id?: string
          message_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: true
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          role: Database['public']['Enums']['chat_role']
          content: string
          cited_pages: number[]
          query_class: string | null
          latency_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          role: Database['public']['Enums']['chat_role']
          content: string
          cited_pages?: number[]
          query_class?: string | null
          latency_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          role?: Database['public']['Enums']['chat_role']
          content?: string
          cited_pages?: number[]
          query_class?: string | null
          latency_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'chat_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      user_feedback: {
        Row: {
          id: string
          user_id: string
          contract_id: string
          rating: Database['public']['Enums']['feedback_rating']
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contract_id: string
          rating: Database['public']['Enums']['feedback_rating']
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contract_id?: string
          rating?: Database['public']['Enums']['feedback_rating']
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_feedback_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      llm_usage: {
        Row: {
          id: string
          user_id: string
          contract_id: string | null
          operation: Database['public']['Enums']['llm_operation']
          model: string
          input_tokens: number
          output_tokens: number
          cached_input_tokens: number
          cost_usd: number
          latency_ms: number
          attempts: number
          success: boolean
          finish_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contract_id?: string | null
          operation: Database['public']['Enums']['llm_operation']
          model: string
          input_tokens?: number
          output_tokens?: number
          cached_input_tokens?: number
          cost_usd?: number
          latency_ms?: number
          attempts?: number
          success: boolean
          finish_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contract_id?: string | null
          operation?: Database['public']['Enums']['llm_operation']
          model?: string
          input_tokens?: number
          output_tokens?: number
          cached_input_tokens?: number
          cost_usd?: number
          latency_ms?: number
          attempts?: number
          success?: boolean
          finish_reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'llm_usage_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limit_events: {
        Row: { id: string; user_id: string | null; subject: string; action: string; created_at: string }
        Insert: { id?: string; user_id?: string | null; subject: string; action: string; created_at?: string }
        Update: { id?: string; user_id?: string | null; subject?: string; action?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: {
      term_corrections: {
        Row: {
          id: string | null
          contract_id: string | null
          user_id: string | null
          contract_type: Database['public']['Enums']['contract_type'] | null
          term_key: string | null
          term_name: string | null
          is_custom: boolean | null
          original_value: string | null
          corrected_value: string | null
          confidence_score: number | null
          edited_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      replace_custom_terms: {
        Args: { p_contract_id: string; p_terms: string[] }
        Returns: Database['public']['Tables']['custom_key_terms']['Row'][]
      }
      edit_key_term: {
        Args: { p_id: string; p_value: string }
        Returns: Database['public']['Tables']['key_terms']['Row']
      }
      get_or_create_chat_session: {
        Args: { p_contract_id: string }
        Returns: Database['public']['Tables']['chat_sessions']['Row']
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: { total: number; nda: number; msa: number }[]
      }
      increment_analyses_count: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      contract_type: 'nda' | 'msa'
      detected_contract_type: 'nda' | 'msa' | 'other'
      contract_status: 'uploaded' | 'processing' | 'completed' | 'error'
      chat_role: 'user' | 'assistant'
      feedback_rating: 'up' | 'down'
      llm_operation: 'extraction' | 'chat'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
