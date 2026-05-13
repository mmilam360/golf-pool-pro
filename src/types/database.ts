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
        Row: { id: string; tournament_id: string; name: string; passcode: string; owner_id: string; pick_count: number; count_scores: number; ob_rule_enabled: boolean; ob_penalty_strokes: number; buy_in_amount: number; payout_structure: Json | null; is_locked: boolean; lock_at: string | null; is_completed: boolean; payment_status: 'draft' | 'active' | 'payment_due' | 'archived_unpaid' | 'refunded'; paid_entry_limit: number; amount_paid_cents: number; activated_at: string | null; last_payment_at: string | null; square_customer_id: string | null; square_payment_ids: string[]; square_order_ids: string[]; created_at: string; updated_at: string }
        Insert: { id?: string; tournament_id: string; name: string; passcode?: string; owner_id: string; pick_count?: number; count_scores?: number; ob_rule_enabled?: boolean; ob_penalty_strokes?: number; buy_in_amount?: number; payout_structure?: Json; is_locked?: boolean; lock_at?: string; payment_status?: 'draft' | 'active' | 'payment_due' | 'archived_unpaid' | 'refunded'; paid_entry_limit?: number; amount_paid_cents?: number; activated_at?: string | null; last_payment_at?: string | null; square_customer_id?: string | null; square_payment_ids?: string[]; square_order_ids?: string[] }
        Update: { name?: string; pick_count?: number; count_scores?: number; ob_rule_enabled?: boolean; ob_penalty_strokes?: number; buy_in_amount?: number; payout_structure?: Json; is_locked?: boolean; lock_at?: string; is_completed?: boolean; payment_status?: 'draft' | 'active' | 'payment_due' | 'archived_unpaid' | 'refunded'; paid_entry_limit?: number; amount_paid_cents?: number; activated_at?: string | null; last_payment_at?: string | null; square_customer_id?: string | null; square_payment_ids?: string[]; square_order_ids?: string[] }
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
      gpp_pool_payments: {
        Row: { id: string; pool_id: string; provider: string; square_payment_id: string | null; square_order_id: string | null; amount_cents: number; entry_count_at_payment: number; entry_limit: number; status: string; created_at: string }
        Insert: { id?: string; pool_id: string; provider?: string; square_payment_id?: string | null; square_order_id?: string | null; amount_cents: number; entry_count_at_payment: number; entry_limit: number; status: string; created_at?: string }
        Update: { provider?: string; square_payment_id?: string | null; square_order_id?: string | null; amount_cents?: number; entry_count_at_payment?: number; entry_limit?: number; status?: string }
      }
      gpp_promo_codes: {
        Row: { id: string; code: string; description: string | null; free_pool: boolean; discount_cents: number | null; max_redemptions: number | null; times_redeemed: number; starts_at: string | null; expires_at: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; code: string; description?: string | null; free_pool?: boolean; discount_cents?: number | null; max_redemptions?: number | null; times_redeemed?: number; starts_at?: string | null; expires_at?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { code?: string; description?: string | null; free_pool?: boolean; discount_cents?: number | null; max_redemptions?: number | null; times_redeemed?: number; starts_at?: string | null; expires_at?: string | null; is_active?: boolean; updated_at?: string }
      }
      gpp_promo_redemptions: {
        Row: { id: string; promo_code_id: string; pool_id: string; user_id: string; discount_cents: number; entry_count_at_redemption: number; created_at: string }
        Insert: { id?: string; promo_code_id: string; pool_id: string; user_id: string; discount_cents?: number; entry_count_at_redemption?: number; created_at?: string }
        Update: { promo_code_id?: string; pool_id?: string; user_id?: string; discount_cents?: number; entry_count_at_redemption?: number; created_at?: string }
      }
    }
  }
}
