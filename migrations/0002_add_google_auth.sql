CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  image_url TEXT,
  google_id TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT 1,
  is_admin BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE todos ADD COLUMN owner_user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_todos_owner_user_id
  ON todos(owner_user_id);