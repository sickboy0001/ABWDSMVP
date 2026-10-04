-- 1. ユーザーテーブルの作成
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

-- 2. TODOテーブルの作成（ユーザーとのリレーション付き）
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  owner_user_id TEXT REFERENCES users(id)
);

-- 3. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_todos_owner_user_id
  ON todos(owner_user_id);
