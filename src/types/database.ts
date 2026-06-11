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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      badges: {
        Row: {
          category: string | null
          code: string
          description_fr: string | null
          icon: string | null
          label_fr: string
          rarity: string | null
        }
        Insert: {
          category?: string | null
          code: string
          description_fr?: string | null
          icon?: string | null
          label_fr: string
          rarity?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          description_fr?: string | null
          icon?: string | null
          label_fr?: string
          rarity?: string | null
        }
        Relationships: []
      }
      bonus_predictions: {
        Row: {
          bonus_key: string
          created_at: string
          id: number
          points: number | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          bonus_key: string
          created_at?: string
          id?: never
          points?: number | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          bonus_key?: string
          created_at?: string
          id?: never
          points?: number | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_predictions_bonus_key_fkey"
            columns: ["bonus_key"]
            isOneToOne: false
            referencedRelation: "tournament_bonuses"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          type: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          type?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_awards: {
        Row: {
          award_date: string
          created_at: string
          id: number
          kind: string
          points: number | null
          user_id: string | null
        }
        Insert: {
          award_date: string
          created_at?: string
          id?: never
          kind: string
          points?: number | null
          user_id?: string | null
        }
        Update: {
          award_date?: string
          created_at?: string
          id?: never
          kind?: string
          points?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_standings: {
        Row: {
          draw: number | null
          ga: number | null
          gd: number | null
          gf: number | null
          group_letter: string | null
          lose: number | null
          played: number | null
          points: number | null
          rank: number | null
          team_id: number
          updated_at: string
          win: number | null
        }
        Insert: {
          draw?: number | null
          ga?: number | null
          gd?: number | null
          gf?: number | null
          group_letter?: string | null
          lose?: number | null
          played?: number | null
          points?: number | null
          rank?: number | null
          team_id: number
          updated_at?: string
          win?: number | null
        }
        Update: {
          draw?: number | null
          ga?: number | null
          gd?: number | null
          gf?: number | null
          group_letter?: string | null
          lose?: number | null
          played?: number | null
          points?: number | null
          rank?: number | null
          team_id?: number
          updated_at?: string
          win?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          api_event_id: string | null
          assist_name: string | null
          created_at: string
          detail: string | null
          id: number
          match_id: number
          minute: number | null
          minute_extra: number | null
          player_name: string | null
          player_out: string | null
          team_id: number | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          api_event_id?: string | null
          assist_name?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          match_id: number
          minute?: number | null
          minute_extra?: number | null
          player_name?: string | null
          player_out?: string | null
          team_id?: number | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          api_event_id?: string | null
          assist_name?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          match_id?: number
          minute?: number | null
          minute_extra?: number | null
          player_name?: string | null
          player_out?: string | null
          team_id?: number | null
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          api_player_id: number | null
          formation: string | null
          grid: string | null
          id: number
          is_starter: boolean
          match_id: number
          player_name: string
          player_number: number | null
          position: string | null
          team_id: number | null
        }
        Insert: {
          api_player_id?: number | null
          formation?: string | null
          grid?: string | null
          id?: never
          is_starter?: boolean
          match_id: number
          player_name: string
          player_number?: number | null
          position?: string | null
          team_id?: number | null
        }
        Update: {
          api_player_id?: number | null
          formation?: string | null
          grid?: string | null
          id?: never
          is_starter?: boolean
          match_id?: number
          player_name?: string
          player_number?: number | null
          position?: string | null
          team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_fixture_id: number | null
          away_placeholder: string | null
          away_score: number | null
          away_score_reg: number | null
          away_team_id: number | null
          group_letter: string | null
          home_placeholder: string | null
          home_score: number | null
          home_score_reg: number | null
          home_team_id: number | null
          id: number
          kickoff: string
          last_synced_at: string | null
          match_number: number | null
          minute: number | null
          round_label: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          status: Database["public"]["Enums"]["match_status"]
          status_long: string | null
          updated_at: string
          venue: string | null
          went_to_extra: boolean
          went_to_pens: boolean
          winner_team_id: number | null
        }
        Insert: {
          api_fixture_id?: number | null
          away_placeholder?: string | null
          away_score?: number | null
          away_score_reg?: number | null
          away_team_id?: number | null
          group_letter?: string | null
          home_placeholder?: string | null
          home_score?: number | null
          home_score_reg?: number | null
          home_team_id?: number | null
          id?: never
          kickoff: string
          last_synced_at?: string | null
          match_number?: number | null
          minute?: number | null
          round_label?: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          status_long?: string | null
          updated_at?: string
          venue?: string | null
          went_to_extra?: boolean
          went_to_pens?: boolean
          winner_team_id?: number | null
        }
        Update: {
          api_fixture_id?: number | null
          away_placeholder?: string | null
          away_score?: number | null
          away_score_reg?: number | null
          away_team_id?: number | null
          group_letter?: string | null
          home_placeholder?: string | null
          home_score?: number | null
          home_score_reg?: number | null
          home_team_id?: number | null
          id?: never
          kickoff?: string
          last_synced_at?: string | null
          match_number?: number | null
          minute?: number | null
          round_label?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          status_long?: string | null
          updated_at?: string
          venue?: string | null
          went_to_extra?: boolean
          went_to_pens?: boolean
          winner_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          cards: boolean
          created_at: string
          daily_recap: boolean
          final_result: boolean
          goals: boolean
          kickoff: boolean
          lock_reminder: boolean
          only_my_preds: boolean
          roast: boolean
          user_id: string
        }
        Insert: {
          cards?: boolean
          created_at?: string
          daily_recap?: boolean
          final_result?: boolean
          goals?: boolean
          kickoff?: boolean
          lock_reminder?: boolean
          only_my_preds?: boolean
          roast?: boolean
          user_id: string
        }
        Update: {
          cards?: boolean
          created_at?: string
          daily_recap?: boolean
          final_result?: boolean
          goals?: boolean
          kickoff?: boolean
          lock_reminder?: boolean
          only_my_preds?: boolean
          roast?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          body: string | null
          created_at: string
          event_key: string
          id: number
          kind: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_key: string
          id?: never
          kind?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          event_key?: string
          id?: never
          kind?: string | null
          title?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          base_points: number | null
          created_at: string
          id: number
          match_id: number
          points: number | null
          pred_away: number
          pred_home: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_points?: number | null
          created_at?: string
          id?: never
          match_id: number
          points?: number | null
          pred_away: number
          pred_home: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_points?: number | null
          created_at?: string
          id?: never
          match_id?: number
          points?: number | null
          pred_away?: number
          pred_home?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          best_streak: number
          created_at: string
          current_streak: number
          display_name: string
          id: string
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          best_streak?: number
          created_at?: string
          current_streak?: number
          display_name: string
          id: string
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          best_streak?: number
          created_at?: string
          current_streak?: number
          display_name?: string
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_state: {
        Row: {
          id: number
          last_live_count: number
          last_run_at: string | null
          live_active: boolean
          next_kickoff: string | null
        }
        Insert: {
          id?: number
          last_live_count?: number
          last_run_at?: string | null
          live_active?: boolean
          next_kickoff?: string | null
        }
        Update: {
          id?: number
          last_live_count?: number
          last_run_at?: string | null
          live_active?: boolean
          next_kickoff?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          api_team_id: number | null
          fifa_code: string | null
          flag_emoji: string | null
          group_letter: string | null
          id: number
          logo_url: string | null
          name: string
          name_fr: string | null
        }
        Insert: {
          api_team_id?: number | null
          fifa_code?: string | null
          flag_emoji?: string | null
          group_letter?: string | null
          id?: never
          logo_url?: string | null
          name: string
          name_fr?: string | null
        }
        Update: {
          api_team_id?: number | null
          fifa_code?: string | null
          flag_emoji?: string | null
          group_letter?: string | null
          id?: never
          logo_url?: string | null
          name?: string
          name_fr?: string | null
        }
        Relationships: []
      }
      tournament_bonuses: {
        Row: {
          key: string
          label: string
          locked_at: string | null
          points: number
          result_value: string | null
          value_kind: string
        }
        Insert: {
          key: string
          label: string
          locked_at?: string | null
          points: number
          result_value?: string | null
          value_kind: string
        }
        Update: {
          key?: string
          label?: string
          locked_at?: string | null
          points?: number
          result_value?: string | null
          value_kind?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          context: Json | null
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_code: string
          context?: Json | null
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          context?: Json | null
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          exact_scores: number | null
          scored_predictions: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
      leaderboard_live: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          live_hits: number | null
          total_live: number | null
          total_official: number | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          live_hits?: never
          total_live?: never
          total_official?: never
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          live_hits?: never
          total_live?: never
          total_official?: never
          user_id?: string | null
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          best_streak: number | null
          current_streak: number | null
          display_name: string | null
          exacts: number | null
          graded: number | null
          hits: number | null
          success_rate: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
      player_team_affinity: {
        Row: {
          avg_pts: number | null
          n: number | null
          team_id: number | null
          user_id: string | null
        }
        Relationships: []
      }
      prediction_points_live: {
        Row: {
          id: number | null
          is_provisional: boolean | null
          live_points: number | null
          match_id: number | null
          match_status: Database["public"]["Enums"]["match_status"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_live"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_badges: { Args: never; Returns: undefined }
      prediction_base_points: {
        Args: { pa: number; ph: number; ra: number; rh: number }
        Returns: number
      }
      recompute_match_points: {
        Args: { p_match_id: number }
        Returns: undefined
      }
      resolve_bonus: { Args: { p_key: string }; Returns: undefined }
      stage_multiplier: {
        Args: { s: Database["public"]["Enums"]["match_stage"] }
        Returns: number
      }
    }
    Enums: {
      event_type:
        | "goal"
        | "own_goal"
        | "penalty_goal"
        | "penalty_missed"
        | "yellow"
        | "red"
        | "subst"
        | "var"
      match_stage:
        | "group"
        | "round32"
        | "round16"
        | "quarter"
        | "semi"
        | "third_place"
        | "final"
      match_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_type: [
        "goal",
        "own_goal",
        "penalty_goal",
        "penalty_missed",
        "yellow",
        "red",
        "subst",
        "var",
      ],
      match_stage: [
        "group",
        "round32",
        "round16",
        "quarter",
        "semi",
        "third_place",
        "final",
      ],
      match_status: ["scheduled", "live", "finished", "postponed", "cancelled"],
    },
  },
} as const
