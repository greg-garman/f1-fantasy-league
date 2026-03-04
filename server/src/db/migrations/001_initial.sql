CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  budget        REAL NOT NULL DEFAULT 100.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS league_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO league_settings (key, value) VALUES
  ('league_name', 'F1 Fantasy League'),
  ('season_year', '2026'),
  ('budget_cap', '100'),
  ('team_size', '5'),
  ('max_transfers_per_race', '2'),
  ('extra_transfer_penalty', '10'),
  ('invite_code', 'f1fantasy2026');

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS f1_drivers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id       TEXT NOT NULL UNIQUE,
  code            TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  constructor_id  TEXT NOT NULL,
  constructor_name TEXT NOT NULL,
  nationality     TEXT,
  number          INTEGER,
  current_price   REAL NOT NULL DEFAULT 10.0,
  initial_price   REAL NOT NULL DEFAULT 10.0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  photo_url       TEXT
);

CREATE TABLE IF NOT EXISTS f1_races (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  season          INTEGER NOT NULL,
  round           INTEGER NOT NULL,
  race_name       TEXT NOT NULL,
  circuit_name    TEXT NOT NULL,
  country         TEXT,
  race_date       TEXT NOT NULL,
  race_time       TEXT,
  quali_date      TEXT,
  quali_time      TEXT,
  sprint_date     TEXT,
  fp1_date        TEXT,
  has_sprint      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'upcoming',
  picks_locked    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(season, round)
);

CREATE TABLE IF NOT EXISTS f1_race_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id         INTEGER NOT NULL REFERENCES f1_races(id),
  driver_id       TEXT NOT NULL,
  session_type    TEXT NOT NULL,
  grid_position   INTEGER,
  finish_position INTEGER,
  position_text   TEXT,
  points_real     REAL DEFAULT 0,
  status          TEXT,
  fastest_lap     INTEGER DEFAULT 0,
  time_or_gap     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(race_id, driver_id, session_type)
);

CREATE TABLE IF NOT EXISTS user_teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  driver_id   TEXT NOT NULL,
  slot        INTEGER NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  price_paid  REAL NOT NULL,
  UNIQUE(user_id, slot)
);

CREATE TABLE IF NOT EXISTS transfers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  race_id         INTEGER NOT NULL REFERENCES f1_races(id),
  driver_out_id   TEXT NOT NULL,
  driver_in_id    TEXT NOT NULL,
  price_out       REAL NOT NULL,
  price_in        REAL NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_picks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  race_id       INTEGER NOT NULL REFERENCES f1_races(id),
  pick_type     TEXT NOT NULL,
  pick_value    TEXT NOT NULL,
  is_correct    INTEGER,
  points_earned REAL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, race_id, pick_type)
);

CREATE TABLE IF NOT EXISTS race_scores (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  race_id             INTEGER NOT NULL REFERENCES f1_races(id),
  team_points         REAL NOT NULL DEFAULT 0,
  picks_points        REAL NOT NULL DEFAULT 0,
  total_points        REAL NOT NULL DEFAULT 0,
  manual_adjustment   REAL NOT NULL DEFAULT 0,
  breakdown_json      TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, race_id)
);

CREATE TABLE IF NOT EXISTS driver_price_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id   TEXT NOT NULL,
  race_id     INTEGER NOT NULL REFERENCES f1_races(id),
  price       REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS h2h_matchups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id     INTEGER NOT NULL REFERENCES f1_races(id),
  driver_a_id TEXT NOT NULL,
  driver_b_id TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_race_results_race ON f1_race_results(race_id);
CREATE INDEX IF NOT EXISTS idx_race_results_driver ON f1_race_results(driver_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_picks_user_race ON weekly_picks(user_id, race_id);
CREATE INDEX IF NOT EXISTS idx_race_scores_user ON race_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
