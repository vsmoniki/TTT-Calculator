-- =============================================
-- WTRL TTT よく使われるコース追加
-- =============================================

INSERT INTO routes (name, world, distance_km, elevation_m, profile_points_json, route_type, source_name, source_url) VALUES
(
  'Tempus Fugit',
  'Watopia',
  17.4,
  47,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":2,"altitude_m":5},{"distance_km":4,"altitude_m":6},{"distance_km":6,"altitude_m":6},{"distance_km":8,"altitude_m":7},{"distance_km":10,"altitude_m":7},{"distance_km":12,"altitude_m":6},{"distance_km":14,"altitude_m":6},{"distance_km":16,"altitude_m":5},{"distance_km":17.4,"altitude_m":5}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/tempus-fugit/'
),
(
  'Watopia''s Waistband',
  'Watopia',
  26.3,
  269,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":2,"altitude_m":8},{"distance_km":4,"altitude_m":22},{"distance_km":6,"altitude_m":45},{"distance_km":8,"altitude_m":68},{"distance_km":10,"altitude_m":72},{"distance_km":12,"altitude_m":55},{"distance_km":14,"altitude_m":38},{"distance_km":16,"altitude_m":20},{"distance_km":18,"altitude_m":10},{"distance_km":20,"altitude_m":8},{"distance_km":22,"altitude_m":6},{"distance_km":24,"altitude_m":5},{"distance_km":26.3,"altitude_m":5}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/watopiaswaistband/'
),
(
  'Greater London Flat',
  'London',
  13.6,
  141,
  '[{"distance_km":0,"altitude_m":25},{"distance_km":1.5,"altitude_m":26},{"distance_km":3,"altitude_m":35},{"distance_km":4.5,"altitude_m":52},{"distance_km":6,"altitude_m":65},{"distance_km":7.5,"altitude_m":58},{"distance_km":9,"altitude_m":42},{"distance_km":10.5,"altitude_m":30},{"distance_km":12,"altitude_m":26},{"distance_km":13.6,"altitude_m":25}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/greater-london-flat/'
),
(
  'Champs-Élysées',
  'France',
  10.6,
  133,
  '[{"distance_km":0,"altitude_m":55},{"distance_km":1,"altitude_m":58},{"distance_km":2,"altitude_m":70},{"distance_km":3,"altitude_m":88},{"distance_km":4,"altitude_m":100},{"distance_km":5,"altitude_m":108},{"distance_km":6,"altitude_m":105},{"distance_km":7,"altitude_m":95},{"distance_km":8,"altitude_m":78},{"distance_km":9,"altitude_m":62},{"distance_km":10,"altitude_m":56},{"distance_km":10.6,"altitude_m":55}]',
  'hilly',
  'Zwift Insider',
  'https://zwiftinsider.com/route/champs-elysees/'
),
(
  'Volcano Flat',
  'Watopia',
  12.1,
  95,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":1.5,"altitude_m":8},{"distance_km":3,"altitude_m":18},{"distance_km":4.5,"altitude_m":28},{"distance_km":6,"altitude_m":32},{"distance_km":7.5,"altitude_m":28},{"distance_km":9,"altitude_m":18},{"distance_km":10.5,"altitude_m":8},{"distance_km":12.1,"altitude_m":5}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/volcano-flat/'
),
(
  'Fuego Flats',
  'Watopia',
  14.6,
  85,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":2,"altitude_m":6},{"distance_km":4,"altitude_m":10},{"distance_km":6,"altitude_m":15},{"distance_km":8,"altitude_m":18},{"distance_km":10,"altitude_m":14},{"distance_km":12,"altitude_m":8},{"distance_km":14.6,"altitude_m":5}]',
  'flat',
  'Zwift Insider',
  'https://zwiftinsider.com/route/fuego-flats/'
),
(
  'Watopia Hilly Route',
  'Watopia',
  25.6,
  297,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":2,"altitude_m":12},{"distance_km":4,"altitude_m":38},{"distance_km":6,"altitude_m":72},{"distance_km":8,"altitude_m":95},{"distance_km":10,"altitude_m":88},{"distance_km":12,"altitude_m":62},{"distance_km":14,"altitude_m":38},{"distance_km":16,"altitude_m":22},{"distance_km":18,"altitude_m":15},{"distance_km":20,"altitude_m":18},{"distance_km":22,"altitude_m":28},{"distance_km":24,"altitude_m":14},{"distance_km":25.6,"altitude_m":5}]',
  'hilly',
  'Zwift Insider',
  'https://zwiftinsider.com/route/watopia-hilly-route/'
),
(
  'Mountain 8',
  'Watopia',
  20.7,
  342,
  '[{"distance_km":0,"altitude_m":5},{"distance_km":2,"altitude_m":18},{"distance_km":4,"altitude_m":55},{"distance_km":6,"altitude_m":110},{"distance_km":8,"altitude_m":148},{"distance_km":10,"altitude_m":162},{"distance_km":12,"altitude_m":145},{"distance_km":14,"altitude_m":115},{"distance_km":16,"altitude_m":75},{"distance_km":18,"altitude_m":32},{"distance_km":20,"altitude_m":10},{"distance_km":20.7,"altitude_m":5}]',
  'hilly',
  'Zwift Insider',
  'https://zwiftinsider.com/route/mountain-8/'
),
(
  'Makuri 40',
  'Makuri Islands',
  40.5,
  388,
  '[{"distance_km":0,"altitude_m":10},{"distance_km":4,"altitude_m":22},{"distance_km":8,"altitude_m":58},{"distance_km":12,"altitude_m":92},{"distance_km":16,"altitude_m":108},{"distance_km":20,"altitude_m":95},{"distance_km":24,"altitude_m":72},{"distance_km":28,"altitude_m":48},{"distance_km":32,"altitude_m":30},{"distance_km":36,"altitude_m":18},{"distance_km":40.5,"altitude_m":10}]',
  'hilly',
  'Zwift Insider',
  'https://zwiftinsider.com/'
);
