-- =============================================
-- アプリ設定（管理画面向け）
-- =============================================

CREATE TABLE IF NOT EXISTS app_settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  settings_json TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO app_settings (id, settings_json)
VALUES (
  1,
  json_object(
    'draft_factor_second', 0.8,
    'draft_factor_other', 0.75,
    'bike_kg', 8,
    'rho', 1.225,
    'crr', 0.004,
    'road_cd', 0.63,
    'tt_cd', 0.55,
    'cda_calibration_multiplier', 0.76,
    'equipment_reference_time_sec', 1668,
    'equipment_cda_sensitivity', 3,
    'default_height_m', 1.75,
    'default_frame_name', 'CADEX tri',
    'default_wheel_name', 'DT Swiss ARC 1100 DICUT 85/Disc',
    'default_frame_flat_delta_sec', 0,
    'default_wheel_flat_delta_sec', 0
  )
)
ON CONFLICT(id) DO NOTHING;
