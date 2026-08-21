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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_color_ledger: {
        Row: {
          audit_color: string
          counted: boolean
          created_at: string
          final_selection: string | null
          final_selection_result: string
          id: string
          independent_audit_result: string | null
          match_id: string | null
          match_label: string
          matrix_prediction_result: string | null
          note: string | null
          result_grade_id: string | null
          user_id: string
        }
        Insert: {
          audit_color: string
          counted?: boolean
          created_at?: string
          final_selection?: string | null
          final_selection_result: string
          id?: string
          independent_audit_result?: string | null
          match_id?: string | null
          match_label: string
          matrix_prediction_result?: string | null
          note?: string | null
          result_grade_id?: string | null
          user_id?: string
        }
        Update: {
          audit_color?: string
          counted?: boolean
          created_at?: string
          final_selection?: string | null
          final_selection_result?: string
          id?: string
          independent_audit_result?: string | null
          match_id?: string | null
          match_label?: string
          matrix_prediction_result?: string | null
          note?: string | null
          result_grade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_color_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_color_ledger_result_grade_id_fkey"
            columns: ["result_grade_id"]
            isOneToOne: false
            referencedRelation: "result_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          calibrated_high: number | null
          calibrated_low: number | null
          calibration_version_id: string | null
          created_at: string
          disagreement_version_id: string | null
          effective_evidence_count: number
          id: string
          independent_decision_committed_at: string | null
          independent_high: number | null
          independent_inputs: Json
          independent_low: number | null
          independent_method_id: string | null
          independent_method_version: string | null
          independent_winner: string | null
          match_id: string
          matrix_revealed_at: string | null
          metrics_version_id: string | null
          raw_signal_count: number
          research_lock_at: string | null
          run_number: number
          stale_reason: string | null
          status: string
          updated_at: string
          user_id: string
          verification_version_id: string | null
        }
        Insert: {
          calibrated_high?: number | null
          calibrated_low?: number | null
          calibration_version_id?: string | null
          created_at?: string
          disagreement_version_id?: string | null
          effective_evidence_count?: number
          id?: string
          independent_decision_committed_at?: string | null
          independent_high?: number | null
          independent_inputs?: Json
          independent_low?: number | null
          independent_method_id?: string | null
          independent_method_version?: string | null
          independent_winner?: string | null
          match_id: string
          matrix_revealed_at?: string | null
          metrics_version_id?: string | null
          raw_signal_count?: number
          research_lock_at?: string | null
          run_number?: number
          stale_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_version_id?: string | null
        }
        Update: {
          calibrated_high?: number | null
          calibrated_low?: number | null
          calibration_version_id?: string | null
          created_at?: string
          disagreement_version_id?: string | null
          effective_evidence_count?: number
          id?: string
          independent_decision_committed_at?: string | null
          independent_high?: number | null
          independent_inputs?: Json
          independent_low?: number | null
          independent_method_id?: string | null
          independent_method_version?: string | null
          independent_winner?: string | null
          match_id?: string
          matrix_revealed_at?: string | null
          metrics_version_id?: string | null
          raw_signal_count?: number
          research_lock_at?: string | null
          run_number?: number
          stale_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_independent_method_id_fkey"
            columns: ["independent_method_id"]
            isOneToOne: false
            referencedRelation: "probability_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      autopsies: {
        Row: {
          audit_color: string | null
          autopsy_type: string
          created_at: string
          first_serve_at: string | null
          id: string
          informs_rule_revision: boolean
          leakage_check_status: string
          match_id: string | null
          result_grade_id: string | null
          retroactive_change_blocked: boolean
          status: string
          summary: string | null
          trigger_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_color?: string | null
          autopsy_type: string
          created_at?: string
          first_serve_at?: string | null
          id?: string
          informs_rule_revision?: boolean
          leakage_check_status?: string
          match_id?: string | null
          result_grade_id?: string | null
          retroactive_change_blocked?: boolean
          status?: string
          summary?: string | null
          trigger_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          audit_color?: string | null
          autopsy_type?: string
          created_at?: string
          first_serve_at?: string | null
          id?: string
          informs_rule_revision?: boolean
          leakage_check_status?: string
          match_id?: string | null
          result_grade_id?: string | null
          retroactive_change_blocked?: boolean
          status?: string
          summary?: string | null
          trigger_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopsies_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopsies_result_grade_id_fkey"
            columns: ["result_grade_id"]
            isOneToOne: false
            referencedRelation: "result_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      autopsy_findings: {
        Row: {
          admissible: boolean
          autopsy_id: string
          created_at: string
          evidence: string | null
          evidence_published_at: string | null
          evidence_source: string | null
          failure_code: string
          failure_label: string
          id: string
          inadmissible_reason: string | null
          publicly_available_pre_match: boolean
          severity: string
          user_id: string
        }
        Insert: {
          admissible?: boolean
          autopsy_id: string
          created_at?: string
          evidence?: string | null
          evidence_published_at?: string | null
          evidence_source?: string | null
          failure_code: string
          failure_label: string
          id?: string
          inadmissible_reason?: string | null
          publicly_available_pre_match?: boolean
          severity?: string
          user_id?: string
        }
        Update: {
          admissible?: boolean
          autopsy_id?: string
          created_at?: string
          evidence?: string | null
          evidence_published_at?: string | null
          evidence_source?: string | null
          failure_code?: string
          failure_label?: string
          id?: string
          inadmissible_reason?: string | null
          publicly_available_pre_match?: boolean
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopsy_findings_autopsy_id_fkey"
            columns: ["autopsy_id"]
            isOneToOne: false
            referencedRelation: "autopsies"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_integrity_checks: {
        Row: {
          board_count: number
          canonical_count: number
          created_at: string
          duplicates: Json
          id: string
          label: string
          status: string
          unresolved: Json
          uploaded_count: number
          user_id: string
        }
        Insert: {
          board_count?: number
          canonical_count?: number
          created_at?: string
          duplicates?: Json
          id?: string
          label: string
          status?: string
          unresolved?: Json
          uploaded_count?: number
          user_id?: string
        }
        Update: {
          board_count?: number
          canonical_count?: number
          created_at?: string
          duplicates?: Json
          id?: string
          label?: string
          status?: string
          unresolved?: Json
          uploaded_count?: number
          user_id?: string
        }
        Relationships: []
      }
      block_reasons: {
        Row: {
          audit_run_id: string | null
          code: string
          created_at: string
          detail: string | null
          id: string
          label: string
          match_id: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          user_id: string
        }
        Insert: {
          audit_run_id?: string | null
          code: string
          created_at?: string
          detail?: string | null
          id?: string
          label: string
          match_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id?: string
        }
        Update: {
          audit_run_id?: string | null
          code?: string
          created_at?: string
          detail?: string | null
          id?: string
          label?: string
          match_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_reasons_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_reasons_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_buckets: {
        Row: {
          bucket_code: string
          bucket_label: string
          calibration_version_id: string
          created_at: string
          graded: number
          id: string
          small_sample: boolean
          user_id: string
          wins: number
          wp_max: number
          wp_min: number
        }
        Insert: {
          bucket_code: string
          bucket_label: string
          calibration_version_id: string
          created_at?: string
          graded?: number
          id?: string
          small_sample?: boolean
          user_id?: string
          wins?: number
          wp_max: number
          wp_min: number
        }
        Update: {
          bucket_code?: string
          bucket_label?: string
          calibration_version_id?: string
          created_at?: string
          graded?: number
          id?: string
          small_sample?: boolean
          user_id?: string
          wins?: number
          wp_max?: number
          wp_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "calibration_buckets_calibration_version_id_fkey"
            columns: ["calibration_version_id"]
            isOneToOne: false
            referencedRelation: "calibration_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_ledger: {
        Row: {
          actual_winner: string | null
          bucket_code: string | null
          calibration_version_after: string | null
          calibration_version_before: string | null
          counted_in_bucket: boolean
          created_at: string
          id: string
          master_sequence: number
          match_date: string | null
          match_id: string | null
          match_label: string
          matrix_predicted_winner: string | null
          matrix_wp: number | null
          note: string | null
          result_grading_status: string
          result_type: string
          surface: string | null
          tournament: string | null
          user_id: string
        }
        Insert: {
          actual_winner?: string | null
          bucket_code?: string | null
          calibration_version_after?: string | null
          calibration_version_before?: string | null
          counted_in_bucket?: boolean
          created_at?: string
          id?: string
          master_sequence: number
          match_date?: string | null
          match_id?: string | null
          match_label: string
          matrix_predicted_winner?: string | null
          matrix_wp?: number | null
          note?: string | null
          result_grading_status?: string
          result_type?: string
          surface?: string | null
          tournament?: string | null
          user_id?: string
        }
        Update: {
          actual_winner?: string | null
          bucket_code?: string | null
          calibration_version_after?: string | null
          calibration_version_before?: string | null
          counted_in_bucket?: boolean
          created_at?: string
          id?: string
          master_sequence?: number
          match_date?: string | null
          match_id?: string | null
          match_label?: string
          matrix_predicted_winner?: string | null
          matrix_wp?: number | null
          note?: string | null
          result_grading_status?: string
          result_type?: string
          surface?: string | null
          tournament?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_versions: {
        Row: {
          created_at: string
          graded_sample_count: number
          id: string
          is_active: boolean
          label: string
          master_sequence_count: number
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          graded_sample_count?: number
          id?: string
          is_active?: boolean
          label: string
          master_sequence_count?: number
          user_id?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          graded_sample_count?: number
          id?: string
          is_active?: boolean
          label?: string
          master_sequence_count?: number
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      disagreement_results: {
        Row: {
          audit_run_id: string
          contradiction_severity: string | null
          created_at: string
          final_effect: string | null
          id: string
          opposing_evidence: string | null
          p1_risk: string | null
          p2_risk: string | null
          rule_code: string
          rule_id: string | null
          rule_name: string
          status: string
          supporting_evidence: string | null
          user_id: string
        }
        Insert: {
          audit_run_id: string
          contradiction_severity?: string | null
          created_at?: string
          final_effect?: string | null
          id?: string
          opposing_evidence?: string | null
          p1_risk?: string | null
          p2_risk?: string | null
          rule_code: string
          rule_id?: string | null
          rule_name: string
          status?: string
          supporting_evidence?: string | null
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          contradiction_severity?: string | null
          created_at?: string
          final_effect?: string | null
          id?: string
          opposing_evidence?: string | null
          p1_risk?: string | null
          p2_risk?: string | null
          rule_code?: string
          rule_id?: string | null
          rule_name?: string
          status?: string
          supporting_evidence?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disagreement_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disagreement_results_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_family_coverage: {
        Row: {
          audit_run_id: string
          coverage_status: string
          covered_count: number
          created_at: string
          critical: boolean
          family_code: string
          family_label: string
          id: string
          p1_covered: number
          p2_covered: number
          required_min: number
          unavailable_count: number
          user_id: string
        }
        Insert: {
          audit_run_id: string
          coverage_status?: string
          covered_count?: number
          created_at?: string
          critical?: boolean
          family_code: string
          family_label: string
          id?: string
          p1_covered?: number
          p2_covered?: number
          required_min?: number
          unavailable_count?: number
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          coverage_status?: string
          covered_count?: number
          created_at?: string
          critical?: boolean
          family_code?: string
          family_label?: string
          id?: string
          p1_covered?: number
          p2_covered?: number
          required_min?: number
          unavailable_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_family_coverage_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_logs: {
        Row: {
          audit_run_id: string | null
          created_at: string
          id: string
          input: Json | null
          match_id: string | null
          matrix_visible: boolean
          output: Json | null
          player_side: string | null
          rule_code: string | null
          rule_version: string | null
          source: string | null
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          audit_run_id?: string | null
          created_at?: string
          id?: string
          input?: Json | null
          match_id?: string | null
          matrix_visible?: boolean
          output?: Json | null
          player_side?: string | null
          rule_code?: string | null
          rule_version?: string | null
          source?: string | null
          stage: string
          status: string
          user_id?: string
        }
        Update: {
          audit_run_id?: string | null
          created_at?: string
          id?: string
          input?: Json | null
          match_id?: string | null
          matrix_visible?: boolean
          output?: Json | null
          player_side?: string | null
          rule_code?: string | null
          rule_version?: string | null
          source?: string | null
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_logs_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      final_decisions: {
        Row: {
          action: string | null
          audit_complete: boolean
          audit_run_id: string
          calibration_bucket: string | null
          completion_percent: number
          created_at: string
          final_audit_color: string
          final_selection: string | null
          gate_report: Json
          id: string
          matrix_firewall_valid: boolean
          updated_at: string
          user_id: string
          verified_win_rate: number | null
        }
        Insert: {
          action?: string | null
          audit_complete?: boolean
          audit_run_id: string
          calibration_bucket?: string | null
          completion_percent?: number
          created_at?: string
          final_audit_color?: string
          final_selection?: string | null
          gate_report?: Json
          id?: string
          matrix_firewall_valid?: boolean
          updated_at?: string
          user_id?: string
          verified_win_rate?: number | null
        }
        Update: {
          action?: string | null
          audit_complete?: boolean
          audit_run_id?: string
          calibration_bucket?: string | null
          completion_percent?: number
          created_at?: string
          final_audit_color?: string
          final_selection?: string | null
          gate_report?: Json
          id?: string
          matrix_firewall_valid?: boolean
          updated_at?: string
          user_id?: string
          verified_win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "final_decisions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versions: {
        Row: {
          created_at: string
          formula: string
          id: string
          is_active: boolean
          metric_code: string
          notes: string | null
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          formula: string
          id?: string
          is_active?: boolean
          metric_code: string
          notes?: string | null
          user_id?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          formula?: string
          id?: string
          is_active?: boolean
          metric_code?: string
          notes?: string | null
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          created_at: string
          id: string
          payload: Json
          report_type: string
          template_version: string
          title: string
          user_id: string
          validation: Json
          validation_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          report_type?: string
          template_version?: string
          title: string
          user_id?: string
          validation?: Json
          validation_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          report_type?: string
          template_version?: string
          title?: string
          user_id?: string
          validation?: Json
          validation_status?: string
        }
        Relationships: []
      }
      match_identity_records: {
        Row: {
          claimed_value: string | null
          created_at: string
          field: string
          id: string
          match_id: string
          note: string | null
          status: string
          user_id: string
          verified_value: string | null
        }
        Insert: {
          claimed_value?: string | null
          created_at?: string
          field: string
          id?: string
          match_id: string
          note?: string | null
          status?: string
          user_id?: string
          verified_value?: string | null
        }
        Update: {
          claimed_value?: string | null
          created_at?: string
          field?: string
          id?: string
          match_id?: string
          note?: string | null
          status?: string
          user_id?: string
          verified_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_identity_records_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          active_summary_version_id: string | null
          actual_first_serve_at: string | null
          actual_winner: string | null
          best_of: number | null
          canonical_key: string
          created_at: string
          event_level: string | null
          final_score: string | null
          id: string
          identity_status: string
          indoor: boolean | null
          match_status: string
          player1_id: string | null
          player1_name: string
          player2_id: string | null
          player2_name: string
          result_recorded_at: string | null
          result_status: string
          round: string | null
          scheduled_date: string | null
          scheduled_local_at: string | null
          scheduled_utc_at: string | null
          surface: string | null
          surface_status: string
          tournament_id: string | null
          tournament_name: string | null
          tournament_timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_summary_version_id?: string | null
          actual_first_serve_at?: string | null
          actual_winner?: string | null
          best_of?: number | null
          canonical_key: string
          created_at?: string
          event_level?: string | null
          final_score?: string | null
          id?: string
          identity_status?: string
          indoor?: boolean | null
          match_status?: string
          player1_id?: string | null
          player1_name: string
          player2_id?: string | null
          player2_name: string
          result_recorded_at?: string | null
          result_status?: string
          round?: string | null
          scheduled_date?: string | null
          scheduled_local_at?: string | null
          scheduled_utc_at?: string | null
          surface?: string | null
          surface_status?: string
          tournament_id?: string | null
          tournament_name?: string | null
          tournament_timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active_summary_version_id?: string | null
          actual_first_serve_at?: string | null
          actual_winner?: string | null
          best_of?: number | null
          canonical_key?: string
          created_at?: string
          event_level?: string | null
          final_score?: string | null
          id?: string
          identity_status?: string
          indoor?: boolean | null
          match_status?: string
          player1_id?: string | null
          player1_name?: string
          player2_id?: string | null
          player2_name?: string
          result_recorded_at?: string | null
          result_status?: string
          round?: string | null
          scheduled_date?: string | null
          scheduled_local_at?: string | null
          scheduled_utc_at?: string | null
          surface?: string | null
          surface_status?: string
          tournament_id?: string | null
          tournament_name?: string | null
          tournament_timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_results: {
        Row: {
          audit_run_id: string
          category: string | null
          created_at: string
          differential: string | null
          evidence_family: string | null
          id: string
          matrix_derived: boolean
          metric_code: string
          metric_name: string
          p1_status: string
          p1_value: string | null
          p2_status: string
          p2_value: string | null
          reliability: number | null
          sample: string | null
          sources: Json
          status: string
          surface_adjusted_diff: string | null
          treatment: string | null
          user_id: string
        }
        Insert: {
          audit_run_id: string
          category?: string | null
          created_at?: string
          differential?: string | null
          evidence_family?: string | null
          id?: string
          matrix_derived?: boolean
          metric_code: string
          metric_name: string
          p1_status?: string
          p1_value?: string | null
          p2_status?: string
          p2_value?: string | null
          reliability?: number | null
          sample?: string | null
          sources?: Json
          status?: string
          surface_adjusted_diff?: string | null
          treatment?: string | null
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          category?: string | null
          created_at?: string
          differential?: string | null
          evidence_family?: string | null
          id?: string
          matrix_derived?: boolean
          metric_code?: string
          metric_name?: string
          p1_status?: string
          p1_value?: string | null
          p2_status?: string
          p2_value?: string | null
          reliability?: number | null
          sample?: string | null
          sources?: Json
          status?: string
          surface_adjusted_diff?: string | null
          treatment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      override_records: {
        Row: {
          active: boolean
          audit_run_id: string | null
          changed_by: string
          created_at: string
          entity_id: string | null
          entity_table: string
          field: string
          id: string
          match_id: string | null
          override_value: string | null
          reason: string
          requires_admin: boolean
          system_value: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          audit_run_id?: string | null
          changed_by?: string
          created_at?: string
          entity_id?: string | null
          entity_table: string
          field: string
          id?: string
          match_id?: string | null
          override_value?: string | null
          reason: string
          requires_admin?: boolean
          system_value?: string | null
          user_id?: string
        }
        Update: {
          active?: boolean
          audit_run_id?: string | null
          changed_by?: string
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          field?: string
          id?: string
          match_id?: string | null
          override_value?: string | null
          reason?: string
          requires_admin?: boolean
          system_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "override_records_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "override_records_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_summary_fields: {
        Row: {
          confidence: number | null
          corrected: boolean
          created_at: string
          extraction_status: string
          field_key: string
          id: string
          normalized_value: string | null
          page_number: number | null
          raw_value: string | null
          summary_version_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          corrected?: boolean
          created_at?: string
          extraction_status?: string
          field_key: string
          id?: string
          normalized_value?: string | null
          page_number?: number | null
          raw_value?: string | null
          summary_version_id: string
          user_id?: string
        }
        Update: {
          confidence?: number | null
          corrected?: boolean
          created_at?: string
          extraction_status?: string
          field_key?: string
          id?: string
          normalized_value?: string | null
          page_number?: number | null
          raw_value?: string | null
          summary_version_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parsed_summary_fields_summary_version_id_fkey"
            columns: ["summary_version_id"]
            isOneToOne: false
            referencedRelation: "summary_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          aliases: string[]
          canonical_name: string
          created_at: string
          id: string
          normalized_key: string
          tour: string | null
          user_id: string
        }
        Insert: {
          aliases?: string[]
          canonical_name: string
          created_at?: string
          id?: string
          normalized_key: string
          tour?: string | null
          user_id?: string
        }
        Update: {
          aliases?: string[]
          canonical_name?: string
          created_at?: string
          id?: string
          normalized_key?: string
          tour?: string | null
          user_id?: string
        }
        Relationships: []
      }
      probability_methods: {
        Row: {
          code: string
          created_at: string
          description: string | null
          formula: string
          id: string
          is_active: boolean
          label: string
          params: Json
          user_id: string
          version_number: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          formula: string
          id?: string
          is_active?: boolean
          label: string
          params?: Json
          user_id?: string
          version_number?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          formula?: string
          id?: string
          is_active?: boolean
          label?: string
          params?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      probability_provenance: {
        Row: {
          audit_run_id: string
          computed_at: string
          display_value: string
          formula: string
          id: string
          inputs: Json
          interpretation_note: string | null
          method_code: string
          method_version: string
          metric_key: string
          numeric_value: number | null
          source_refs: Json
          user_id: string
        }
        Insert: {
          audit_run_id: string
          computed_at?: string
          display_value: string
          formula: string
          id?: string
          inputs?: Json
          interpretation_note?: string | null
          method_code: string
          method_version: string
          metric_key: string
          numeric_value?: number | null
          source_refs?: Json
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          computed_at?: string
          display_value?: string
          formula?: string
          id?: string
          inputs?: Json
          interpretation_note?: string | null
          method_code?: string
          method_version?: string
          metric_key?: string
          numeric_value?: number | null
          source_refs?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "probability_provenance_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reconstruction_results: {
        Row: {
          assumptions: string | null
          audit_run_id: string
          created_at: string
          formula: string | null
          formula_version_id: string | null
          formula_version_label: string | null
          id: string
          inputs: Json
          metric_code: string
          output: string | null
          player_side: string
          reliability: number | null
          status: string
          user_id: string
        }
        Insert: {
          assumptions?: string | null
          audit_run_id: string
          created_at?: string
          formula?: string | null
          formula_version_id?: string | null
          formula_version_label?: string | null
          id?: string
          inputs?: Json
          metric_code: string
          output?: string | null
          player_side: string
          reliability?: number | null
          status?: string
          user_id?: string
        }
        Update: {
          assumptions?: string | null
          audit_run_id?: string
          created_at?: string
          formula?: string | null
          formula_version_id?: string | null
          formula_version_label?: string | null
          id?: string
          inputs?: Json
          metric_code?: string
          output?: string | null
          player_side?: string
          reliability?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconstruction_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconstruction_results_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      result_grades: {
        Row: {
          actual_winner: string | null
          audit_color: string | null
          audit_run_id: string | null
          correction_pattern: string
          counted_in_matrix_calibration: boolean
          created_at: string
          final_selection: string | null
          final_selection_result: string
          graded_at: string
          id: string
          independent_audit_result: string
          independent_high: number | null
          independent_low: number | null
          independent_winner: string | null
          match_id: string
          matrix_predicted_winner: string | null
          matrix_prediction_result: string
          matrix_wp: number | null
          note: string | null
          result_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_winner?: string | null
          audit_color?: string | null
          audit_run_id?: string | null
          correction_pattern?: string
          counted_in_matrix_calibration?: boolean
          created_at?: string
          final_selection?: string | null
          final_selection_result?: string
          graded_at?: string
          id?: string
          independent_audit_result?: string
          independent_high?: number | null
          independent_low?: number | null
          independent_winner?: string | null
          match_id: string
          matrix_predicted_winner?: string | null
          matrix_prediction_result?: string
          matrix_wp?: number | null
          note?: string | null
          result_type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_winner?: string | null
          audit_color?: string | null
          audit_run_id?: string | null
          correction_pattern?: string
          counted_in_matrix_calibration?: boolean
          created_at?: string
          final_selection?: string | null
          final_selection_result?: string
          graded_at?: string
          id?: string
          independent_audit_result?: string
          independent_high?: number | null
          independent_low?: number | null
          independent_winner?: string | null
          match_id?: string
          matrix_predicted_winner?: string | null
          matrix_prediction_result?: string
          matrix_wp?: number | null
          note?: string | null
          result_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_grades_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_grades_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_document_versions: {
        Row: {
          activation_status: string
          created_at: string
          document_id: string
          expected_rules: number
          headings_detected: number | null
          id: string
          is_active: boolean
          pages_detected: number | null
          parsed_rules: number
          parser_confidence: number | null
          raw_text: string | null
          source_filename: string | null
          unmapped_rules: number
          user_id: string
          version_number: number
        }
        Insert: {
          activation_status?: string
          created_at?: string
          document_id: string
          expected_rules?: number
          headings_detected?: number | null
          id?: string
          is_active?: boolean
          pages_detected?: number | null
          parsed_rules?: number
          parser_confidence?: number | null
          raw_text?: string | null
          source_filename?: string | null
          unmapped_rules?: number
          user_id?: string
          version_number?: number
        }
        Update: {
          activation_status?: string
          created_at?: string
          document_id?: string
          expected_rules?: number
          headings_detected?: number | null
          id?: string
          is_active?: boolean
          pages_detected?: number | null
          parsed_rules?: number
          parser_confidence?: number | null
          raw_text?: string | null
          source_filename?: string | null
          unmapped_rules?: number
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rule_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_documents: {
        Row: {
          active_version_id: string | null
          created_at: string
          doc_type: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          doc_type: string
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          blocking: boolean
          body: string | null
          category: string | null
          created_at: string
          id: string
          machine_logic: Json | null
          mapping_status: string
          rule_code: string
          rule_name: string
          severity: string
          user_id: string
          version_id: string
        }
        Insert: {
          blocking?: boolean
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          machine_logic?: Json | null
          mapping_status?: string
          rule_code: string
          rule_name: string
          severity?: string
          user_id?: string
          version_id: string
        }
        Update: {
          blocking?: boolean
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          machine_logic?: Json | null
          mapping_status?: string
          rule_code?: string
          rule_name?: string
          severity?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "rule_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_conflicts: {
        Row: {
          audit_run_id: string
          created_at: string
          critical: boolean
          data_key: string
          id: string
          resolution_reason: string | null
          resolution_status: string
          selected_value: string | null
          user_id: string
          values: Json
        }
        Insert: {
          audit_run_id: string
          created_at?: string
          critical?: boolean
          data_key: string
          id?: string
          resolution_reason?: string | null
          resolution_status?: string
          selected_value?: string | null
          user_id?: string
          values?: Json
        }
        Update: {
          audit_run_id?: string
          created_at?: string
          critical?: boolean
          data_key?: string
          id?: string
          resolution_reason?: string | null
          resolution_status?: string
          selected_value?: string | null
          user_id?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "source_conflicts_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_definitions: {
        Row: {
          access_method: string
          active: boolean
          approved: boolean
          blacklist_reason: string | null
          blacklisted: boolean
          category: string
          consecutive_failures: number
          created_at: string
          domain: string | null
          error_history: Json
          fallback_source_id: string | null
          health_status: string
          id: string
          last_fetch_at: string | null
          priority: number
          quota_per_day: number | null
          quota_reset_at: string | null
          quota_used: number
          refresh_minutes: number
          reliability: number
          source_name: string
          supported_data: string[]
          terms_status: string
          terms_url: string | null
          user_id: string
        }
        Insert: {
          access_method?: string
          active?: boolean
          approved?: boolean
          blacklist_reason?: string | null
          blacklisted?: boolean
          category?: string
          consecutive_failures?: number
          created_at?: string
          domain?: string | null
          error_history?: Json
          fallback_source_id?: string | null
          health_status?: string
          id?: string
          last_fetch_at?: string | null
          priority?: number
          quota_per_day?: number | null
          quota_reset_at?: string | null
          quota_used?: number
          refresh_minutes?: number
          reliability?: number
          source_name: string
          supported_data?: string[]
          terms_status?: string
          terms_url?: string | null
          user_id?: string
        }
        Update: {
          access_method?: string
          active?: boolean
          approved?: boolean
          blacklist_reason?: string | null
          blacklisted?: boolean
          category?: string
          consecutive_failures?: number
          created_at?: string
          domain?: string | null
          error_history?: Json
          fallback_source_id?: string | null
          health_status?: string
          id?: string
          last_fetch_at?: string | null
          priority?: number
          quota_per_day?: number | null
          quota_reset_at?: string | null
          quota_used?: number
          refresh_minutes?: number
          reliability?: number
          source_name?: string
          supported_data?: string[]
          terms_status?: string
          terms_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_definitions_fallback_source_id_fkey"
            columns: ["fallback_source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_health_events: {
        Row: {
          attempt: number
          audit_run_id: string | null
          backoff_ms: number | null
          created_at: string
          data_key: string | null
          event_type: string
          fallback_used: string | null
          http_status: number | null
          id: string
          message: string | null
          resolved: boolean
          source_id: string | null
          source_name: string
          temporary: boolean
          user_id: string
        }
        Insert: {
          attempt?: number
          audit_run_id?: string | null
          backoff_ms?: number | null
          created_at?: string
          data_key?: string | null
          event_type: string
          fallback_used?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          resolved?: boolean
          source_id?: string | null
          source_name: string
          temporary?: boolean
          user_id?: string
        }
        Update: {
          attempt?: number
          audit_run_id?: string | null
          backoff_ms?: number | null
          created_at?: string
          data_key?: string | null
          event_type?: string
          fallback_used?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          resolved?: boolean
          source_id?: string | null
          source_name?: string
          temporary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_health_events_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_health_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_snapshots: {
        Row: {
          audit_run_id: string
          created_at: string
          data_key: string
          excluded: boolean
          id: string
          normalized_value: string | null
          player_side: string | null
          post_start: boolean
          raw_value: string | null
          reliability: number | null
          retrieved_at: string
          source_id: string | null
          source_name: string
          user_id: string
        }
        Insert: {
          audit_run_id: string
          created_at?: string
          data_key: string
          excluded?: boolean
          id?: string
          normalized_value?: string | null
          player_side?: string | null
          post_start?: boolean
          raw_value?: string | null
          reliability?: number | null
          retrieved_at?: string
          source_id?: string | null
          source_name: string
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          created_at?: string
          data_key?: string
          excluded?: boolean
          id?: string
          normalized_value?: string | null
          player_side?: string | null
          post_start?: boolean
          raw_value?: string | null
          reliability?: number | null
          retrieved_at?: string
          source_id?: string | null
          source_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_snapshots_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      stress_results: {
        Row: {
          audit_run_id: string
          created_at: string
          id: string
          outcome: string
          range_after: string | null
          range_before: string | null
          status: string
          test_code: string
          test_name: string
          user_id: string
          winner_after: string | null
          winner_before: string | null
        }
        Insert: {
          audit_run_id: string
          created_at?: string
          id?: string
          outcome?: string
          range_after?: string | null
          range_before?: string | null
          status?: string
          test_code: string
          test_name: string
          user_id?: string
          winner_after?: string | null
          winner_before?: string | null
        }
        Update: {
          audit_run_id?: string
          created_at?: string
          id?: string
          outcome?: string
          range_after?: string | null
          range_before?: string | null
          status?: string
          test_code?: string
          test_name?: string
          user_id?: string
          winner_after?: string | null
          winner_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stress_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_pages: {
        Row: {
          char_count: number
          confidence: number | null
          created_at: string
          extraction_method: string
          id: string
          note: string | null
          page_number: number
          status: string
          text_content: string | null
          upload_id: string
          user_id: string
        }
        Insert: {
          char_count?: number
          confidence?: number | null
          created_at?: string
          extraction_method?: string
          id?: string
          note?: string | null
          page_number: number
          status?: string
          text_content?: string | null
          upload_id: string
          user_id?: string
        }
        Update: {
          char_count?: number
          confidence?: number | null
          created_at?: string
          extraction_method?: string
          id?: string
          note?: string | null
          page_number?: number
          status?: string
          text_content?: string | null
          upload_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summary_pages_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "summary_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_uploads: {
        Row: {
          created_at: string
          extraction_status: string
          filename: string
          id: string
          page_count: number | null
          pages_failed: number
          pages_processed: number
          pages_vision: number
          parse_status: string
          raw_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extraction_status?: string
          filename: string
          id?: string
          page_count?: number | null
          pages_failed?: number
          pages_processed?: number
          pages_vision?: number
          parse_status?: string
          raw_text?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          extraction_status?: string
          filename?: string
          id?: string
          page_count?: number | null
          pages_failed?: number
          pages_processed?: number
          pages_vision?: number
          parse_status?: string
          raw_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      summary_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_id: string
          page_number: number | null
          upload_id: string
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_id: string
          page_number?: number | null
          upload_id: string
          user_id?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_id?: string
          page_number?: number | null
          upload_id?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "summary_versions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summary_versions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "summary_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          edition_year: number | null
          event_level: string | null
          id: string
          indoor: boolean | null
          name: string
          surface: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          edition_year?: number | null
          event_level?: string | null
          id?: string
          indoor?: boolean | null
          name: string
          surface?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          edition_year?: number | null
          event_level?: string | null
          id?: string
          indoor?: boolean | null
          name?: string
          surface?: string | null
          user_id?: string
        }
        Relationships: []
      }
      underdog_results: {
        Row: {
          audit_run_id: string
          classification: string
          created_at: string
          evidence: string | null
          id: string
          pathway_code: string
          pathway_name: string
          player_side: string
          repeatable: boolean
          status: string
          user_id: string
        }
        Insert: {
          audit_run_id: string
          classification?: string
          created_at?: string
          evidence?: string | null
          id?: string
          pathway_code: string
          pathway_name: string
          player_side: string
          repeatable?: boolean
          status?: string
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          classification?: string
          created_at?: string
          evidence?: string | null
          id?: string
          pathway_code?: string
          pathway_name?: string
          player_side?: string
          repeatable?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "underdog_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_results: {
        Row: {
          audit_run_id: string
          created_at: string
          decision_effect: string | null
          id: string
          outcome: string
          p1_finding: string | null
          p2_finding: string | null
          rule_code: string
          rule_id: string | null
          rule_name: string
          severity: string | null
          sources: Json
          status: string
          user_id: string
        }
        Insert: {
          audit_run_id: string
          created_at?: string
          decision_effect?: string | null
          id?: string
          outcome?: string
          p1_finding?: string | null
          p2_finding?: string | null
          rule_code: string
          rule_id?: string | null
          rule_name: string
          severity?: string | null
          sources?: Json
          status?: string
          user_id?: string
        }
        Update: {
          audit_run_id?: string
          created_at?: string
          decision_effect?: string | null
          id?: string
          outcome?: string
          p1_finding?: string | null
          p2_finding?: string | null
          rule_code?: string
          rule_id?: string | null
          rule_name?: string
          severity?: string | null
          sources?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
