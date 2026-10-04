-- 3. ABWDS シミュレーション用テーブル群の作成

-- 3.1 シナリオ（設定パラメータ）テーブル
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT 1,
    config_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3.2 実行記録（シード値・再現性管理）テーブル
CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    user_id TEXT,
    seed_value INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', -- running, completed, aborted
    max_turns INTEGER NOT NULL DEFAULT 200,
    final_turn INTEGER DEFAULT 0,
    parent_run_id TEXT,
    fork_at_turn INTEGER DEFAULT NULL,
    summary_json TEXT, -- サマリーKPI一括保存 (初期ジニ、最終ジニ、生存率など)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_run_id) REFERENCES simulation_runs(id) ON DELETE SET NULL
);

-- 3.3 ターン別マクロ集計ログテーブル（グラフ描画用）
CREATE TABLE IF NOT EXISTS turn_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    gini_index REAL NOT NULL,
    survivor_count INTEGER NOT NULL,
    mean_wealth REAL NOT NULL,
    median_wealth REAL NOT NULL,
    top_1_share REAL NOT NULL,
    top_10_share REAL NOT NULL,
    bottom_50_share REAL NOT NULL,
    histogram_json TEXT,
    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
);

-- 3.4 イベントログテーブル（政策介入・重要アラート履歴）
CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    event_detail_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_scenario ON simulation_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_turn_logs_run_turn ON turn_logs(run_id, turn);
CREATE INDEX IF NOT EXISTS idx_event_logs_run ON event_logs(run_id);
