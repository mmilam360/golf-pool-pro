export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      gpp_profiles: {
        Row: { id: string; display_name: string; email: string; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string; email?: string }
        Update: { display_name?: string; email?: string }
      }
      gpp_tournaments: {
        Row: { id: string; external_id: string | null; name: string; course: string | null; location: string | null; start_date: string; end_date: string; season: number | null; tour: string; status: string; field_json: Json | null; leaderboard_json: Json | null; cut_score: number | null; last_scores_fetch: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; external_id?: string; name: string; course?: string; location?: string; start_date: string; end_date: string; season?: number; tour?: string; status?: string; field_json?: Json; leaderboard_json?: Json; cut_score?: number }
        Update: { name?: string; status?: string; field_json?: Json; leaderboard_json?: Json; cut_score?: number; last_scores_fetch?: string }
      }
      gpp_pools: {
        Row: { id: string; tournament_id: string; name: string; passcode: string; owner_id: string; pick_count: number; count_scores: number; ob_rule_enabled: boolean; ob_penalty_strokes: number; buy_in_amount: number; payout_structure: Json | null; is_locked: boolean; lock_at: string | null; is_completed: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; tournament_id: string; name: string; passcode?: string; owner_id: string; pick_count?: number; count_scores?: number; ob_rule_enabled?: boolean; ob_penalty_strokes?: number; buy_in_amount?: number; payout_structure?: Json; is_locked?: boolean; lock_at?: string }
        Update: { name?: string; pick_count?: number; count_scores?: number; ob_rule_enabled?: boolean; ob_penalty_strokes?: number; buy_in_amount?: number; payout_structure?: Json; is_locked?: boolean; lock_at?: string; is_completed?: boolean }
      }
      gpp_entries: {
        Row: { id: string; pool_id: string; user_id: string; display_name: string; golfer_picks: Json; total_score: number | null; counting_scores: Json | null; rank: number | null; has_paid: boolean; payout_amount: number; is_removed: boolean; removed_reason: string | null; removed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; pool_id: string; user_id: string; display_name?: string; golfer_picks?: Json; has_paid?: boolean }
        Update: { golfer_picks?: Json; display_name?: string; total_score?: number | null; counting_scores?: Json | null; rank?: number | null; has_paid?: boolean; payout_amount?: number; is_removed?: boolean; removed_reason?: string; removed_at?: string }
      }
      gpp_email_log: {
        Row: { id: string; pool_id: string; sender_id: string; subject: string; body: string; recipient_count: number; sent_at: string }
        Insert: { pool_id: string; sender_id: string; subject: string; body?: string; recipient_count?: number }
        Update: {}
      }
    }
  }
}
