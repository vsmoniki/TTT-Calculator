// =============================================
// TTT Calculator - 型定義
// =============================================

/** Cloudflare Workers の環境変数・バインディング */
export interface Env {
  DB: D1Database;
  SECRET_PASSWORD: string;
}

// ---- D1 Row 型 ----

export interface RiderRow {
  id: number;
  name: string;
  weight_kg: number;
  height_cm: number | null;
  ftp_w: number;
  preferred_pull_sec: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: number;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: number;
  team_id: number;
  rider_id: number;
  created_at: string;
}

export interface RouteRow {
  id: number;
  name: string;
  world: string;
  distance_km: number;
  elevation_m: number;
  profile_points_json: string;
  route_type: string;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrameRow {
  id: number;
  name: string;
  bike_type: string;
  drop_shop_price: number | null;
  level_required: number | null;
  aero_score: number | null;
  climb_score: number | null;
  flat_delta_sec: number | null;
  climb_delta_sec: number | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WheelRow {
  id: number;
  name: string;
  drop_shop_price: number | null;
  level_required: number | null;
  aero_score: number | null;
  climb_score: number | null;
  flat_delta_sec: number | null;
  climb_delta_sec: number | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineupRow {
  id: number;
  team_id: number;
  name: string;
  route_id: number | null;
  target_speed_kph: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineupMemberRow {
  id: number;
  lineup_id: number;
  rider_id: number;
  frame_id: number | null;
  wheel_id: number | null;
  order_index: number;
  created_at: string;
}

export interface AppSettingsRow {
  id: number;
  settings_json: string;
  updated_at: string;
}

// ---- APIリクエスト型 ----

export interface CreateRiderBody {
  name: string;
  weight_kg: number;
  height_cm?: number;
  ftp_w: number;
  preferred_pull_sec?: number;
  notes?: string;
}

export interface UpdateRiderBody {
  name?: string;
  weight_kg?: number;
  height_cm?: number;
  ftp_w?: number;
  preferred_pull_sec?: number;
  notes?: string;
}

export interface CreateTeamBody {
  name: string;
  notes?: string;
}

export interface AddTeamMemberBody {
  rider_id: number;
}

export interface CreateLineupBody {
  team_id: number;
  name: string;
  route_id?: number;
  target_speed_kph?: number;
  notes?: string;
}

export interface UpdateLineupBody {
  name?: string;
  route_id?: number;
  target_speed_kph?: number;
  notes?: string;
}

export interface AddLineupMemberBody {
  rider_id: number;
  frame_id?: number;
  wheel_id?: number;
  order_index: number;
}

export interface UpdateLineupMemberBody {
  frame_id?: number;
  wheel_id?: number;
  order_index?: number;
}

export interface SimulateBody {
  route_id: number;
  lineup_id: number;
  target_speed_kph?: number;
  target_time_sec?: number;
  draft_factor_second?: number;
  draft_factor_other?: number;
}


export interface UpdateSettingsBody {
  draft_factor_second?: number;
  draft_factor_other?: number;
  bike_kg?: number;
  rho?: number;
  crr?: number;
  road_cd?: number;
  tt_cd?: number;
  cda_calibration_multiplier?: number;
  equipment_reference_time_sec?: number;
  equipment_cda_sensitivity?: number;
  default_height_m?: number;
  default_frame_name?: string;
  default_wheel_name?: string;
  default_frame_flat_delta_sec?: number;
  default_wheel_flat_delta_sec?: number;
}
