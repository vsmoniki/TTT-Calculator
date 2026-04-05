-- =============================================
-- デフォルト機材データ更新（Cadex Tri / ARC1100 85-Disc）
-- =============================================

INSERT INTO frames (
  name, bike_type, drop_shop_price, level_required,
  aero_score, climb_score, flat_delta_sec, climb_delta_sec,
  source_name, source_url
)
SELECT
  'Cadex Tri', 'tt', 1500000, 5,
  9.9, 5.0, -74.0, -16.0,
  'ZwifterBikes', 'https://zwifterbikes.web.app/'
WHERE NOT EXISTS (
  SELECT 1 FROM frames WHERE lower(name) = 'cadex tri'
);

UPDATE frames
SET
  bike_type = 'tt',
  drop_shop_price = 1500000,
  level_required = 5,
  aero_score = 9.9,
  climb_score = 5.0,
  flat_delta_sec = -74.0,
  climb_delta_sec = -16.0,
  source_name = 'ZwifterBikes',
  source_url = 'https://zwifterbikes.web.app/'
WHERE lower(name) = 'cadex tri';

INSERT INTO wheels (
  name, drop_shop_price, level_required,
  aero_score, climb_score, flat_delta_sec, climb_delta_sec,
  source_name, source_url
)
SELECT
  'DT Swiss ARC 1100 DICUT 85/Disc', 1000000, 5,
  9.8, 4.2, -34.0, -7.0,
  'ZwifterBikes', 'https://zwifterbikes.web.app/'
WHERE NOT EXISTS (
  SELECT 1 FROM wheels WHERE lower(name) = lower('DT Swiss ARC 1100 DICUT 85/Disc')
);

UPDATE wheels
SET
  drop_shop_price = 1000000,
  level_required = 5,
  aero_score = 9.8,
  climb_score = 4.2,
  flat_delta_sec = -34.0,
  climb_delta_sec = -7.0,
  source_name = 'ZwifterBikes',
  source_url = 'https://zwifterbikes.web.app/'
WHERE lower(name) = lower('DT Swiss ARC 1100 DICUT 85/Disc');
