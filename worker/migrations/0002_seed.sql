-- =============================================
-- TTT Calculator - Seed Data
-- =============================================

-- ----------------------------------------
-- Routes（コース）
-- profile_points_json は {distance_km, altitude_m} の配列
-- ----------------------------------------

INSERT INTO routes (name, world, distance_km, elevation_m, profile_points_json, route_type, source_name, source_url) VALUES
(
  'Watopia Flat Route',
  'Watopia',
  12.2,
  56,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":1,"altitude_m":5},{"distance_km":2,"altitude_m":7},{"distance_km":3,"altitude_m":8},{"distance_km":4,"altitude_m":6},{"distance_km":5,"altitude_m":5},{"distance_km":6,"altitude_m":5},{"distance_km":7,"altitude_m":7},{"distance_km":8,"altitude_m":10},{"distance_km":9,"altitude_m":8},{"distance_km":10,"altitude_m":6},{"distance_km":11,"altitude_m":5},{"distance_km":12.2,"altitude_m":5}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/watopia-flat-route/'
),
(
  'Innsbruck KOM',
  'Innsbruck',
  38.2,
  1185,
  '[{"distance_km":0,"altitude_m":580},{"distance_km":3,"altitude_m":590},{"distance_km":6,"altitude_m":610},{"distance_km":9,"altitude_m":650},{"distance_km":12,"altitude_m":700},{"distance_km":15,"altitude_m":760},{"distance_km":18,"altitude_m":820},{"distance_km":20,"altitude_m":875},{"distance_km":22,"altitude_m":920},{"distance_km":24,"altitude_m":970},{"distance_km":26,"altitude_m":1010},{"distance_km":28,"altitude_m":1040},{"distance_km":30,"altitude_m":1060},{"distance_km":32,"altitude_m":1070},{"distance_km":34,"altitude_m":1065},{"distance_km":36,"altitude_m":1050},{"distance_km":38.2,"altitude_m":1000}]',
  'climbing',
  'Zwift Insider',
  'https://zwiftinsider.com/route/innsbruckring/'
),
(
  'Richmond UCI Circuit',
  'Richmond',
  10.8,
  138,
  '[{"distance_km":0,"altitude_m":40},{"distance_km":1,"altitude_m":42},{"distance_km":2,"altitude_m":55},{"distance_km":3,"altitude_m":75},{"distance_km":4,"altitude_m":90},{"distance_km":5,"altitude_m":95},{"distance_km":6,"altitude_m":80},{"distance_km":7,"altitude_m":60},{"distance_km":8,"altitude_m":50},{"distance_km":9,"altitude_m":42},{"distance_km":10,"altitude_m":40},{"distance_km":10.8,"altitude_m":40}]',
  'hilly',
  'Zwift Insider',
  'https://zwiftinsider.com/route/richmond-uci-circuit/'
);

-- ----------------------------------------
-- Frames（フレーム）
-- aero_score: 高いほど空力優秀（0〜10 想定）
-- flat_delta_sec: マイナスほど速い（reference比）
-- ----------------------------------------

INSERT INTO frames (name, bike_type, drop_shop_price, level_required, aero_score, climb_score, flat_delta_sec, climb_delta_sec, source_name, source_url) VALUES
(
  'Zwift Concept Z1 (Tron)',
  'road',
  NULL,
  NULL,
  8.5,
  8.5,
  -48.0,
  -55.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
),
(
  'Specialized S-Works Venge',
  'road',
  509000,
  10,
  9.0,
  5.0,
  -58.0,
  -20.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
),
(
  'Canyon Aeroad 2021',
  'road',
  612000,
  15,
  8.8,
  5.5,
  -55.0,
  -22.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
);

-- ----------------------------------------
-- Wheels（ホイール）
-- ----------------------------------------

INSERT INTO wheels (name, drop_shop_price, level_required, aero_score, climb_score, flat_delta_sec, climb_delta_sec, source_name, source_url) VALUES
(
  'Zipp 808/Super-9 Disc',
  182500,
  28,
  9.2,
  4.0,
  -30.0,
  -5.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
),
(
  'Zipp 404 Firecrest',
  264500,
  32,
  8.2,
  6.0,
  -24.0,
  -15.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
),
(
  'DT Swiss ARC 62 DICUT',
  NULL,
  NULL,
  7.5,
  7.0,
  -20.0,
  -20.0,
  'ZwifterBikes',
  'https://zwifterbikes.web.app/'
);

-- ----------------------------------------
-- Riders（サンプルライダー）
-- ----------------------------------------

INSERT INTO riders (name, weight_kg, height_cm, ftp_w, preferred_pull_sec, notes) VALUES
('Alice', 58.0, 165, 240, 30, 'TTT主力 クライマー気質'),
('Bob',   72.0, 178, 290, 45, 'TTT主力 平坦番長'),
('Carol', 62.0, 168, 260, 30, 'サポート役');

-- ----------------------------------------
-- Teams（サンプルチーム）
-- ----------------------------------------

INSERT INTO teams (name, notes) VALUES
('Sample Team Alpha', 'サンプル用チーム');

-- team_members（team_id=1, rider_id=1,2,3）
INSERT INTO team_members (team_id, rider_id) VALUES
(1, 1),
(1, 2),
(1, 3);

-- ----------------------------------------
-- Lineups（サンプルラインナップ）
-- ----------------------------------------

INSERT INTO lineups (team_id, name, route_id, target_speed_kph, notes) VALUES
(1, 'Watopia Flat TT', 1, 45.0, 'Watopia平坦コースでの練習想定');

-- lineup_members（lineup_id=1）
INSERT INTO lineup_members (lineup_id, rider_id, frame_id, wheel_id, order_index) VALUES
(1, 2, 2, 1, 1),  -- Bob: 先頭, Venge + Zipp808
(1, 1, 1, 2, 2),  -- Alice: 2番手, Tron + Zipp404
(1, 3, 3, 3, 3);  -- Carol: 3番手以降, Aeroad + DT Swiss
