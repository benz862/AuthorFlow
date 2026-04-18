export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          email: string | null
          onboarding_completed: boolean
          default_trim_size: string | null
          preferred_writing_style: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null
          onboarding_completed?: boolean
          default_trim_size?: string | null
          preferred_writing_style?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null
          onboarding_completed?: boolean
          default_trim_size?: string | null
          preferred_writing_style?: string | null
          updated_at?: string
        }
      }
      subscription_status: {
        Row: {
          id: string
          user_id: string
          plan_code: string
          subscription_status: string
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          trial_ends_at: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_code?: string
          subscription_status?: string
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          trial_ends_at?: string | null
          last_synced_at?: string | null
        }
        Update: {
          plan_code?: string
          subscription_status?: string
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          trial_ends_at?: string | null
          last_synced_at?: string | null
          updated_at?: string
        }
      }
      plan_limits: {
        Row: {
          id: string
          plan_code: string
          max_active_projects: number | null
          max_books_per_month: number | null
          max_category: string | null
          research_depth: string | null
          monthly_cover_generations: number | null
          monthly_illustration_generations: number | null
          monthly_pdf_exports: number | null
          monthly_text_exports: number | null
          monthly_regenerations: number | null
          source_vault_enabled: boolean
          version_history_enabled: boolean
          children_mode_enabled: boolean
          export_presets_enabled: boolean
          priority_level: number
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      usage_counters: {
        Row: {
          id: string
          user_id: string
          usage_month: string
          books_created: number
          cover_generations: number
          illustration_generations: number
          pdf_exports: number
          text_exports: number
          regenerations: number
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      book_projects: {
        Row: {
          id: string
          user_id: string
          title: string
          subtitle: string | null
          slug: string | null
          status: string
          category: string
          book_type: string
          audience: string | null
          age_range: string | null
          reading_level: string | null
          tone: string | null
          intent: string | null
          trim_size: string | null
          page_size_label: string | null
          children_mode: boolean
          illustration_style: string | null
          factual_mode: boolean
          outline_locked: boolean
          current_version_number: number
          last_exported_at: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          subtitle?: string | null
          slug?: string | null
          status?: string
          category: string
          book_type: string
          audience?: string | null
          age_range?: string | null
          reading_level?: string | null
          tone?: string | null
          intent?: string | null
          trim_size?: string | null
          page_size_label?: string | null
          children_mode?: boolean
          illustration_style?: string | null
          factual_mode?: boolean
          outline_locked?: boolean
          current_version_number?: number
          last_exported_at?: string | null
          archived?: boolean
        }
        Update: { [key: string]: unknown }
      }
      book_intake_answers: {
        Row: {
          id: string
          project_id: string
          question_key: string
          question_text: string
          answer_text: string | null
          answer_json: Json | null
          sequence_no: number | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      book_outlines: {
        Row: {
          id: string
          project_id: string
          version_number: number
          is_current: boolean
          is_approved: boolean
          outline_markdown: string | null
          outline_json: Json | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      book_chapters: {
        Row: {
          id: string
          project_id: string
          version_number: number
          chapter_number: number
          title: string
          summary: string | null
          content_markdown: string | null
          word_count: number
          source_coverage_score: number | null
          status: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      chapter_revisions: {
        Row: {
          id: string
          chapter_id: string
          revision_number: number
          change_type: string | null
          prompt_used: string | null
          content_markdown: string | null
          created_by: string
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: never
      }
      book_versions: {
        Row: {
          id: string
          project_id: string
          version_number: number
          label: string | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: never
      }
      book_sources: {
        Row: {
          id: string
          project_id: string
          source_url: string
          source_title: string | null
          domain: string | null
          source_type: string | null
          published_at: string | null
          retrieved_at: string | null
          credibility_score: number | null
          notes: string | null
          extracted_summary: string | null
          raw_metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      source_claims: {
        Row: {
          id: string
          source_id: string
          claim_text: string
          claim_type: string | null
          confidence_score: number | null
          supporting_excerpt: string | null
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: never
      }
      book_assets: {
        Row: {
          id: string
          project_id: string
          asset_type: string
          storage_path: string
          public_url: string | null
          mime_type: string | null
          file_size_bytes: number | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      illustration_prompts: {
        Row: {
          id: string
          project_id: string
          scene_number: number | null
          chapter_number: number | null
          prompt_text: string
          style_notes: string | null
          character_notes: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      export_jobs: {
        Row: {
          id: string
          project_id: string
          version_number: number
          export_type: string
          export_profile: string | null
          status: string
          output_asset_id: string | null
          error_message: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      processing_jobs: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          job_type: string
          status: string
          priority: number
          payload: Json | null
          result: Json | null
          error_message: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      subscription_customers: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string
          created_at: string
          updated_at: string
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      admin_audit_log: {
        Row: {
          id: string
          actor_user_id: string | null
          target_user_id: string | null
          action: string
          metadata: Json | null
          created_at: string
        }
        Insert: { [key: string]: unknown }
        Update: never
      }
    }
    Functions: {
      get_or_create_usage: {
        Args: { p_user_id: string }
        Returns: Database['public']['Tables']['usage_counters']['Row']
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type SubscriptionStatus = Database['public']['Tables']['subscription_status']['Row']
export type PlanLimits = Database['public']['Tables']['plan_limits']['Row']
export type UsageCounters = Database['public']['Tables']['usage_counters']['Row']
export type BookProject = Database['public']['Tables']['book_projects']['Row']
export type BookIntakeAnswer = Database['public']['Tables']['book_intake_answers']['Row']
export type BookOutline = Database['public']['Tables']['book_outlines']['Row']
export type BookChapter = Database['public']['Tables']['book_chapters']['Row']
export type ChapterRevision = Database['public']['Tables']['chapter_revisions']['Row']
export type BookVersion = Database['public']['Tables']['book_versions']['Row']
export type BookSource = Database['public']['Tables']['book_sources']['Row']
export type SourceClaim = Database['public']['Tables']['source_claims']['Row']
export type BookAsset = Database['public']['Tables']['book_assets']['Row']
export type IllustrationPrompt = Database['public']['Tables']['illustration_prompts']['Row']
export type ExportJob = Database['public']['Tables']['export_jobs']['Row']
export type ProcessingJob = Database['public']['Tables']['processing_jobs']['Row']
