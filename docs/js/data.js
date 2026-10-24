// =============================================
// バンドルデータ（全クライアント版）
// worker/migrations の seed SQL から自動生成したもの。手で書き写した値はない。
//   コース: 0003_wtrl_courses.sql（WTRL 9件）+ 0002_seed.sql（3件）
//   機材/ライダー: 0002_seed.sql（0004 は同値の冪等再投入のため差分なし・検証済み）
//   設定: 0005_app_settings.sql
// 再生成: node ~/workspace/ttt-verify/extract-data.mjs
// =============================================

export const COURSES = [
 {
  "id": 1,
  "name": "Tempus Fugit",
  "world": "Watopia",
  "distanceKm": 17.4,
  "elevationM": 47,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/tempus-fugit/",
  "profile": [
   [
    0,
    5
   ],
   [
    2,
    5
   ],
   [
    4,
    6
   ],
   [
    6,
    6
   ],
   [
    8,
    7
   ],
   [
    10,
    7
   ],
   [
    12,
    6
   ],
   [
    14,
    6
   ],
   [
    16,
    5
   ],
   [
    17.4,
    5
   ]
  ]
 },
 {
  "id": 2,
  "name": "Watopia's Waistband",
  "world": "Watopia",
  "distanceKm": 26.3,
  "elevationM": 269,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/watopiaswaistband/",
  "profile": [
   [
    0,
    5
   ],
   [
    2,
    8
   ],
   [
    4,
    22
   ],
   [
    6,
    45
   ],
   [
    8,
    68
   ],
   [
    10,
    72
   ],
   [
    12,
    55
   ],
   [
    14,
    38
   ],
   [
    16,
    20
   ],
   [
    18,
    10
   ],
   [
    20,
    8
   ],
   [
    22,
    6
   ],
   [
    24,
    5
   ],
   [
    26.3,
    5
   ]
  ]
 },
 {
  "id": 3,
  "name": "Greater London Flat",
  "world": "London",
  "distanceKm": 13.6,
  "elevationM": 141,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/greater-london-flat/",
  "profile": [
   [
    0,
    25
   ],
   [
    1.5,
    26
   ],
   [
    3,
    35
   ],
   [
    4.5,
    52
   ],
   [
    6,
    65
   ],
   [
    7.5,
    58
   ],
   [
    9,
    42
   ],
   [
    10.5,
    30
   ],
   [
    12,
    26
   ],
   [
    13.6,
    25
   ]
  ]
 },
 {
  "id": 4,
  "name": "Champs-Élysées",
  "world": "France",
  "distanceKm": 10.6,
  "elevationM": 133,
  "routeType": "hilly",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/champs-elysees/",
  "profile": [
   [
    0,
    55
   ],
   [
    1,
    58
   ],
   [
    2,
    70
   ],
   [
    3,
    88
   ],
   [
    4,
    100
   ],
   [
    5,
    108
   ],
   [
    6,
    105
   ],
   [
    7,
    95
   ],
   [
    8,
    78
   ],
   [
    9,
    62
   ],
   [
    10,
    56
   ],
   [
    10.6,
    55
   ]
  ]
 },
 {
  "id": 5,
  "name": "Volcano Flat",
  "world": "Watopia",
  "distanceKm": 12.1,
  "elevationM": 95,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/volcano-flat/",
  "profile": [
   [
    0,
    5
   ],
   [
    1.5,
    8
   ],
   [
    3,
    18
   ],
   [
    4.5,
    28
   ],
   [
    6,
    32
   ],
   [
    7.5,
    28
   ],
   [
    9,
    18
   ],
   [
    10.5,
    8
   ],
   [
    12.1,
    5
   ]
  ]
 },
 {
  "id": 6,
  "name": "Fuego Flats",
  "world": "Watopia",
  "distanceKm": 14.6,
  "elevationM": 85,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/fuego-flats/",
  "profile": [
   [
    0,
    5
   ],
   [
    2,
    6
   ],
   [
    4,
    10
   ],
   [
    6,
    15
   ],
   [
    8,
    18
   ],
   [
    10,
    14
   ],
   [
    12,
    8
   ],
   [
    14.6,
    5
   ]
  ]
 },
 {
  "id": 7,
  "name": "Watopia Hilly Route",
  "world": "Watopia",
  "distanceKm": 25.6,
  "elevationM": 297,
  "routeType": "hilly",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/watopia-hilly-route/",
  "profile": [
   [
    0,
    5
   ],
   [
    2,
    12
   ],
   [
    4,
    38
   ],
   [
    6,
    72
   ],
   [
    8,
    95
   ],
   [
    10,
    88
   ],
   [
    12,
    62
   ],
   [
    14,
    38
   ],
   [
    16,
    22
   ],
   [
    18,
    15
   ],
   [
    20,
    18
   ],
   [
    22,
    28
   ],
   [
    24,
    14
   ],
   [
    25.6,
    5
   ]
  ]
 },
 {
  "id": 8,
  "name": "Mountain 8",
  "world": "Watopia",
  "distanceKm": 20.7,
  "elevationM": 342,
  "routeType": "hilly",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/mountain-8/",
  "profile": [
   [
    0,
    5
   ],
   [
    2,
    18
   ],
   [
    4,
    55
   ],
   [
    6,
    110
   ],
   [
    8,
    148
   ],
   [
    10,
    162
   ],
   [
    12,
    145
   ],
   [
    14,
    115
   ],
   [
    16,
    75
   ],
   [
    18,
    32
   ],
   [
    20,
    10
   ],
   [
    20.7,
    5
   ]
  ]
 },
 {
  "id": 9,
  "name": "Makuri 40",
  "world": "Makuri Islands",
  "distanceKm": 40.5,
  "elevationM": 388,
  "routeType": "hilly",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/",
  "profile": [
   [
    0,
    10
   ],
   [
    4,
    22
   ],
   [
    8,
    58
   ],
   [
    12,
    92
   ],
   [
    16,
    108
   ],
   [
    20,
    95
   ],
   [
    24,
    72
   ],
   [
    28,
    48
   ],
   [
    32,
    30
   ],
   [
    36,
    18
   ],
   [
    40.5,
    10
   ]
  ]
 },
 {
  "id": 10,
  "name": "Watopia Flat Route",
  "world": "Watopia",
  "distanceKm": 12.2,
  "elevationM": 56,
  "routeType": "flat",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/watopia-flat-route/",
  "profile": [
   [
    0,
    5
   ],
   [
    1,
    5
   ],
   [
    2,
    7
   ],
   [
    3,
    8
   ],
   [
    4,
    6
   ],
   [
    5,
    5
   ],
   [
    6,
    5
   ],
   [
    7,
    7
   ],
   [
    8,
    10
   ],
   [
    9,
    8
   ],
   [
    10,
    6
   ],
   [
    11,
    5
   ],
   [
    12.2,
    5
   ]
  ]
 },
 {
  "id": 11,
  "name": "Innsbruck KOM",
  "world": "Innsbruck",
  "distanceKm": 38.2,
  "elevationM": 1185,
  "routeType": "climbing",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/innsbruckring/",
  "profile": [
   [
    0,
    580
   ],
   [
    3,
    590
   ],
   [
    6,
    610
   ],
   [
    9,
    650
   ],
   [
    12,
    700
   ],
   [
    15,
    760
   ],
   [
    18,
    820
   ],
   [
    20,
    875
   ],
   [
    22,
    920
   ],
   [
    24,
    970
   ],
   [
    26,
    1010
   ],
   [
    28,
    1040
   ],
   [
    30,
    1060
   ],
   [
    32,
    1070
   ],
   [
    34,
    1065
   ],
   [
    36,
    1050
   ],
   [
    38.2,
    1000
   ]
  ]
 },
 {
  "id": 12,
  "name": "Richmond UCI Circuit",
  "world": "Richmond",
  "distanceKm": 10.8,
  "elevationM": 138,
  "routeType": "hilly",
  "sourceName": "Zwift Insider",
  "sourceUrl": "https://zwiftinsider.com/route/richmond-uci-circuit/",
  "profile": [
   [
    0,
    40
   ],
   [
    1,
    42
   ],
   [
    2,
    55
   ],
   [
    3,
    75
   ],
   [
    4,
    90
   ],
   [
    5,
    95
   ],
   [
    6,
    80
   ],
   [
    7,
    60
   ],
   [
    8,
    50
   ],
   [
    9,
    42
   ],
   [
    10,
    40
   ],
   [
    10.8,
    40
   ]
  ]
 }
];

export const FRAMES = [
 {
  "id": 1,
  "name": "Cadex Tri",
  "bikeType": "tt",
  "aeroScore": 9.9,
  "climbScore": 5,
  "flatDeltaSec": -74,
  "climbDeltaSec": -16,
  "dropShopPrice": 1500000,
  "levelRequired": 5,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 2,
  "name": "Zwift Concept Z1 (Tron)",
  "bikeType": "road",
  "aeroScore": 8.5,
  "climbScore": 8.5,
  "flatDeltaSec": -48,
  "climbDeltaSec": -55,
  "dropShopPrice": null,
  "levelRequired": null,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 3,
  "name": "Specialized S-Works Venge",
  "bikeType": "road",
  "aeroScore": 9,
  "climbScore": 5,
  "flatDeltaSec": -58,
  "climbDeltaSec": -20,
  "dropShopPrice": 509000,
  "levelRequired": 10,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 4,
  "name": "Canyon Aeroad 2021",
  "bikeType": "road",
  "aeroScore": 8.8,
  "climbScore": 5.5,
  "flatDeltaSec": -55,
  "climbDeltaSec": -22,
  "dropShopPrice": 612000,
  "levelRequired": 15,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 }
];

export const WHEELS = [
 {
  "id": 1,
  "name": "DT Swiss ARC 1100 DICUT 85/Disc",
  "aeroScore": 9.8,
  "climbScore": 4.2,
  "flatDeltaSec": -34,
  "climbDeltaSec": -7,
  "dropShopPrice": 1000000,
  "levelRequired": 5,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 2,
  "name": "Zipp 808/Super-9 Disc",
  "aeroScore": 9.2,
  "climbScore": 4,
  "flatDeltaSec": -30,
  "climbDeltaSec": -5,
  "dropShopPrice": 182500,
  "levelRequired": 28,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 3,
  "name": "Zipp 404 Firecrest",
  "aeroScore": 8.2,
  "climbScore": 6,
  "flatDeltaSec": -24,
  "climbDeltaSec": -15,
  "dropShopPrice": 264500,
  "levelRequired": 32,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 },
 {
  "id": 4,
  "name": "DT Swiss ARC 62 DICUT",
  "aeroScore": 7.5,
  "climbScore": 7,
  "flatDeltaSec": -20,
  "climbDeltaSec": -20,
  "dropShopPrice": null,
  "levelRequired": null,
  "sourceName": "ZwifterBikes",
  "sourceUrl": "https://zwifterbikes.web.app/"
 }
];

// サンプルライダー（初回起動時に localStorage へ seed される）
// ※ 0002 のサンプルは Alice/Bob/Carol の3人だけ。Dave は
//   「開いてすぐ4人編成で計算できる」状態にするため追加したサンプル。
export const SAMPLE_RIDERS = [
 {
  "id": 1,
  "name": "Alice",
  "weightKg": 58,
  "heightCm": 165,
  "ftpW": 240,
  "bikeType": "road",
  "preferredPullSec": 30,
  "notes": "TTT主力 クライマー気質"
 },
 {
  "id": 2,
  "name": "Bob",
  "weightKg": 72,
  "heightCm": 178,
  "ftpW": 290,
  "bikeType": "road",
  "preferredPullSec": 45,
  "notes": "TTT主力 平坦番長"
 },
 {
  "id": 3,
  "name": "Carol",
  "weightKg": 62,
  "heightCm": 168,
  "ftpW": 260,
  "bikeType": "road",
  "preferredPullSec": 30,
  "notes": "サポート役"
 },
 {
  "id": 4,
  "name": "Dave",
  "weightKg": 70,
  "heightCm": 175,
  "ftpW": 275,
  "bikeType": "road",
  "preferredPullSec": 30,
  "notes": "サンプル追加（4人編成の初回体験用）"
 }
];

// 0005 app_settings のデフォルト値
export const DEFAULT_SETTINGS = {
 "draft_factor_2": 0.8,
 "draft_factor_3": 0.75,
 "draft_factor_4": 0.75,
 "draft_factor_5": 0.75,
 "draft_factor_6": 0.75,
 "draft_factor_7": 0.75,
 "draft_factor_8": 0.75,
 "bike_kg": 8,
 "rho": 1.225,
 "crr": 0.004,
 "road_cd": 0.63,
 "tt_cd": 0.55,
 "cda_calibration_multiplier": 0.76,
 "equipment_reference_time_sec": 1668,
 "equipment_cda_sensitivity": 3,
 "default_height_m": 1.75,
 "default_frame_name": "CADEX tri",
 "default_wheel_name": "DT Swiss ARC 1100 DICUT 85/Disc",
 "default_frame_flat_delta_sec": 0,
 "default_wheel_flat_delta_sec": 0
};

// デフォルト機材（0005 の default_frame_name / default_wheel_name を解決したもの）
// Cadex Tri は TT フレームだが、Zwift の TTT では TT でもドラフトが効くので
// 初期表示でもドラフト込みの計算になる。
export const DEFAULT_FRAME_ID = 1;
export const DEFAULT_WHEEL_ID = 1;

export const findCourse = (id) => COURSES.find((c) => c.id === Number(id)) ?? null;
export const findFrame = (id) => FRAMES.find((f) => f.id === Number(id)) ?? null;
export const findWheel = (id) => WHEELS.find((w) => w.id === Number(id)) ?? null;
