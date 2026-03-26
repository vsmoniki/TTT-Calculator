-- =============================================
-- TTT Calculator - D1 Schema
-- =============================================

-- ライダー
CREATE TABLE IF NOT EXISTS riders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  weight_kg  REAL    NOT NULL,
  height_cm  INTEGER,
  ftp_w      INTEGER NOT NULL,
  preferred_pull_sec INTEGER,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- チーム
CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- チームメンバー（ライダーとチームの中間テーブル）
CREATE TABLE IF NOT EXISTS team_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rider_id  INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, rider_id)
);

-- コース
CREATE TABLE IF NOT EXISTS routes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  world               TEXT    NOT NULL,
  distance_km         REAL    NOT NULL,
  elevation_m         INTEGER NOT NULL,
  profile_points_json TEXT    NOT NULL DEFAULT '[]',  -- [{distance_km, altitude_m}, ...]
  route_type          TEXT    NOT NULL DEFAULT 'flat', -- flat / hilly / climbing
  source_name         TEXT,
  source_url          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- フレーム
CREATE TABLE IF NOT EXISTS frames (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  bike_type       TEXT    NOT NULL DEFAULT 'road', -- road / tt
  drop_shop_price INTEGER,
  level_required  INTEGER,
  aero_score      REAL,
  climb_score     REAL,
  flat_delta_sec  REAL,   -- 平坦での秒数差（マイナスが速い）
  climb_delta_sec REAL,   -- 登りでの秒数差
  source_name     TEXT,
  source_url      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ホイール
CREATE TABLE IF NOT EXISTS wheels (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  drop_shop_price INTEGER,
  level_required  INTEGER,
  aero_score      REAL,
  climb_score     REAL,
  flat_delta_sec  REAL,
  climb_delta_sec REAL,
  source_name     TEXT,
  source_url      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ラインナップ（その日の出走編成）
CREATE TABLE IF NOT EXISTS lineups (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id          INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  route_id         INTEGER REFERENCES routes(id),
  target_speed_kph REAL,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, name)
);

-- ラインナップメンバー
CREATE TABLE IF NOT EXISTS lineup_members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lineup_id   INTEGER NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  rider_id    INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  frame_id    INTEGER REFERENCES frames(id),
  wheel_id    INTEGER REFERENCES wheels(id),
  order_index INTEGER NOT NULL CHECK(order_index BETWEEN 1 AND 8),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lineup_id, rider_id),
  UNIQUE(lineup_id, order_index)
);
