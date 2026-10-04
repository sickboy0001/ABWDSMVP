
## 1. 再現性を担保するための論理構成図（ER図）

```
+-------------------+        1 : N        +-----------------------+
|    users          |<-------------------|  scenarios            |
| (ユーザー情報)    |                    | (シミュレーション設定)|
+-------------------+                    +-----------------------+
                                                     │ 1
                                                     │
                                                     │ N
                                         +-----------------------+
                                         |  simulation_runs      |
                                         | (実行単位 / シード保持)|
                                         +-----------------------+
                                            │ 1             │ 1
                                            │               │
                                            │ N             │ N
                    +-----------------------+               +-----------------------+
                    |  turn_logs            |               |  event_logs           |
                    | (ターンごとの集計ログ)|               | (主要な決定・ランダム |
                    +-----------------------+               |  イベントの個別ログ)  |
                                                            +-----------------------+

```

Turso（SQLite互換DB）に保持すべきデータ構造とスキーマ定義案です。

クライアント（ブラウザ）主導で計算を行うハイブリッド構成を前提とし、**「5万人×1000ターンの全個別データを保存するとDB容量が爆発する」問題**を回避するため、 Tursoには**パラメータ設定、乱数シード値、ターン毎の集計結果（マクロデータ）、主要イベントログ**のみを持たせる軽量設計にします。

---

### 1. 各テーブルが保持すべきデータ一覧

#### ① `users` （ユーザー・認証管理）

* ユーザーID、メアド、パスワードハッシュ、作成日時

#### ② `scenarios` （シミュレーションルール・初期設定）

* シナリオID、作成者ユーザーID、シナリオ名、公開フラグ（共有用）
* **パラメータJSON (`config_json`)**: 仕様書第2章（初期資産分布、各種モジュールのON/OFFや数値設定）をJSON型で一括保持

#### ③ `simulation_runs` （実行単位・シード値保持）

* 実行ID、元シナリオID、実行ユーザーID、実行ステータス（完了/途中停止）
* **乱数シード値 (`seed_value`)**: 再現性担保の核心（例: `98237410928471`）
* **親実行ID (`parent_run_id`)**: What-If分岐実行時の元となった実行ID
* **分岐ターン (`fork_at_turn`)**: 何ターン目からルール変更して分岐したか

#### ④ `turn_logs` （ターンごとの集計・KPIデータ）

※全エージェント個別データではなく、グラフ描画に必要な集計値のみを記録（容量節約）

* ログID、実行ID、ターン数
* **主要KPI**: ジニ係数、生存者数、平均資産、中央値、Top1%/Top10%/Bottom50%の資産シェア
* **ヒストグラムデータ (`histogram_json`)**: 資産階層ごとの人数分布データ（配列JSON）

#### ⑤ `event_logs` （主要決定・介入イベントログ）

* イベントID、実行ID、発生ターン数
* **イベント種別**: `POLICY_INTERVENTION`（途中のUBI金額変更など）、`MASS_BANKRUPT`（大量脱落）、`CONFIG_CHANGE`
* **詳細データ (`event_detail_json`)**: 変更前の値・変更後の値などの詳細

---

### 2. Turso用 DDL (SQLテーブル作成クエリ)

```sql
-- 1. ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. シナリオ（設定パラメータ）テーブル
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    -- ルール設定群（エージェント数、税率、UBI、強者優遇ルール等をすべて包含）
    config_json TEXT NOT NULL, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 実行記録（シード値・再現性管理）テーブル
CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    seed_value INTEGER NOT NULL,          -- 100%再現用の固定乱数シード
    status TEXT NOT NULL DEFAULT 'running',-- running, completed, aborted
    max_turns INTEGER NOT NULL DEFAULT 1000,
    final_turn INTEGER DEFAULT 0,
    -- 分岐（What-If）実行用リレーション
    parent_run_id TEXT,                    -- 分岐元の run_id
    fork_at_turn INTEGER DEFAULT NULL,     -- 分岐したターン数
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_id) REFERENCES scenarios(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_run_id) REFERENCES simulation_runs(id)
);

-- 4. ターン別マクロ集計ログテーブル（グラフ描画用）
CREATE TABLE IF NOT EXISTS turn_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    gini_index REAL NOT NULL,              -- ジニ係数 (0.000 ~ 1.000)
    survivor_count INTEGER NOT NULL,       -- 生存人数
    mean_wealth REAL NOT NULL,             -- 平均資産
    median_wealth REAL NOT NULL,           -- 資産中央値
    top_1_share REAL NOT NULL,             -- 上位1%の資産シェア
    top_10_share REAL NOT NULL,            -- 上位10%の資産シェア
    bottom_50_share REAL NOT NULL,         -- 下位50%の資産シェア
    histogram_json TEXT,                   -- 階層ヒストグラム描画用データ [10, 45, 120, ...]
    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
);

-- 5. イベントログテーブル（政策介入・重要アラート履歴）
CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    event_type TEXT NOT NULL,              -- 'POLICY_CHANGE', 'MASS_DROPOUT' 等
    message TEXT NOT NULL,                 -- UI表示用メッセージ
    event_detail_json TEXT,                -- パラメータ変更前後の差分等
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
);

-- インデックス設定（取得高速化）
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_scenario ON simulation_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_turn_logs_run_turn ON turn_logs(run_id, turn);
```

---

### 3. このDB設計のポイント

1. **JSONデータの活用 (`config_json`)**:
モジュール追加（例: 新しい税制ルールなど）があってもテーブルの列を追加（ALTER TABLE）することなく、フロントエンド・バックエンドのアプリコード修正のみでフレキシブルに対応できます。
2. **容量・パフォーマンスの最適化**:
5万人の個別ログを毎ターン保存すると1回の実行で数百MB〜GB規模になりますが、この設計では集計値（マクロ指標）のみを保持するため、1回の実行（1,000ターン）あたり**わずか数MB以下**に抑えられます。
3. **What-If（分岐実行）の追跡**:
`parent_run_id` と `fork_at_turn` を持たせることで、「Turn 100でUBIを導入した世界線」と「導入しなかった世界線」の比較ツリー構造を容易にDB上で保持・検索できます。
