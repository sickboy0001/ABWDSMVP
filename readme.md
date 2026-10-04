# ABWDS (Agent-Based Wealth Dynamics Simulator) MVP

要求仕様書（`docs/01_Requirements.md`）に基づき構築された、マルチエージェント型・富の動態シミュレーションWebアプリケーションのMVP（Minimum Viable Product）です。

Cloudflare Workers + Hono (TypeScript) + Turso (LibSQL) + HTML5 Canvas によるハイブリッドアーキテクチャを採用し、ブラウザ上での爆速・決定論的シミュレーションとTursoへの結果・パラメータ永続化を実現しています。

---

## ■ 本番デプロイURL (Cloudflare)

> **本番URL:** `https://abwds.watanabe-yuta0612.workers.dev`  
> *(※ デプロイ完了後に提示・更新予定)*

---

## 1. システム概要・特徴

- **決定論的ヤードセールシミュレーション（100%再現性）:**
  - 擬似乱数生成器（PRNG: Mulberry32）により、同一パラメータ・同一シード値であれば完全に同じ結果をブラウザ上で再現。
  - リプレイ実行（Exact Replay）、別世界線実行（New Seed Run）に完全対応。
- **特大・高精細フルワイド可視化（HTML5 Canvas）:**
  - 横幅いっぱい（最大1400px、内部解像度 `1200×520`）に広がる高fpsチャート。
  - **🧍 個人別資産動態（ペン・パレード表示）:**
    - 基準線（¥0）の直下に人型ピクトグラム（🧍）を横一列に敷き詰め、頭上から個々人の資産バーが立ち上がるインフォグラフィック風チャート。
    - **富の昇順（パレード）:** 初期は均等だったバーから、1人へ富が凝縮していくヤードセール現象を視覚化。
    - **エージェントID順（上下動）:** 個人の立ち位置を固定し、取引ごとのリアルタイムな資産変動（生の動き）を観察。
    - **マウスホバー & 追跡ピン（📍）:** カーソルを合わせるとエージェント詳細カード（資産、順位、直前増減▲▼、勝敗）がポップアップ。クリックで順位が入れ替わってもピン留め追跡可能。
- **多彩な分析ビュー（タブ切替）:**
  - 📊 資産分布ヒストグラム（階層別人数バーチャート）
  - 🤝 ヤードセール動態（取引ネットワーク & 富の移動フロー）
  - 📉 個別資産レース（オリガルヒ化プロセスの推移ライン）
  - 📐 ローレンツ曲線（完全平等線とジニ係数積算面積）
  - 📈 ジニ推移グラフ（ターン毎の格差変動）
- **シンプルな環境設定（MVP仕様）:**
  - シナリオ作成時は「人口（エージェント数）」「初期資産」「最大ターン数」のみを入力する最小限の設計。
  - 途中の政策介入コントロールは排除し、純粋なヤードセールモデルの挙動検証にフォーカス。
- **整理されたUIレイアウト:**
  - 設定パラメータ、リアルタイム指標（KPI）、階層別資産シェア、イベントログは標準では折りたたまれており、下部ドロワーから開閉可能。
  - ヘッダー部に進行、ジニ係数（色変化）、生存者数、平均資産、SEED値が常時インライン表示。
- **Turso永続化連携 & 詳細レポート:**
  - シナリオ設定をDB管理。シミュレーション完了後にワンクリックでTursoへ結果保存。
  - 結果詳細レポート画面（`/runs/:id`）: エグゼクティブ・サマリー、KPIカード、ターン別ログテーブル、CSVダウンロード、完全再現リプレイ。

---

## 2. 画面一覧・ルート

| 画面 / パス | 概要 |
|---|---|
| `/` | **シナリオ一覧・ダッシュボード**: 登録済みシナリオ一覧、新規作成、ワンクリック施行、直近の施行履歴表示 |
| `/scenarios/new` | **新規シナリオ作成**: 人口（50〜5000人）、初期資産、最大ターン数の環境設定とプリセット入力 |
| `/scenarios/:id/edit` | **シナリオ編集**: 既存シナリオの設定内容変更 |
| `/scenarios/:id/run` | **シナリオ施行（シミュレーター）**: 大画面チャート、再生/一時停止/コマ送り、結果のTurso保存 |
| `/runs` | **施行履歴一覧**: Tursoに登録された過去の実行記録一覧、リプレイ実行へのリンク |
| `/runs/:id` | **結果詳細レポート**: エグゼクティブ・サマリー、ターン別KPIテーブル、CSVエクスポート、完全再現リプレイ |
| `/login` | **ログイン画面**: Google OAuth による任意ログイン（未ログインのゲストでも全機能利用可） |

---

## 3. コマンド一覧

| コマンド | 用途 |
|---|---|
| `npm run dev` | Wrangler ローカル開発サーバー起動 (`http://localhost:8787`) |
| `npm run deploy` | Cloudflare Workers 本番環境へデプロイ |
| `npm run typecheck` | TypeScript 型チェック (`tsc --noEmit`) |
| `npm run db:migrate` | Turso DB へのマイグレーション適用 & プリセットシナリオ初期投入 |
| `npm run test:engine` | シミュレーションエンジンの決定論性・KPI計算テスト |

---

## 4. データモデルおよびデータベース設計 (Turso / LibSQL)

Turso上に以下のテーブル群を配置し、シナリオやシミュレーション実行結果を完全に永続化します。

### 4.1 テーブル一覧
- **`users`**: ユーザーアカウント情報（Google OAuth連携、ID、メール、表示名、アバターURL）
- **`scenarios`**: シナリオ基本情報および実行設定JSON（`config_json`）
- **`simulation_runs`**: シミュレーション施行記録（シード値、最終ターン、サマリーKPI）
- **`turn_logs`**: ターン毎のマクロ統計ログ（ジニ係数、生存人数、平均資産、中央値、階層別シェア、ヒストグラムJSON）
- **`event_logs`**: 発生イベント履歴（シミュレーション開始・終了等）

```sql
-- シナリオ定義テーブル
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    config_json TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 施行記録テーブル
CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    seed_value INTEGER NOT NULL,
    final_turn INTEGER NOT NULL,
    max_turns INTEGER NOT NULL,
    summary_json TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ターン別ログテーブル
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
    histogram_json TEXT
);
```

---

## 5. 将来拡張モジュールのロードマップ

本MVP（純粋ヤードセールモデル・最小環境設定）を基盤として、以下の拡張モジュールを順次追加する予定です：

1. **📊 初期資産分布モジュール (Distribution):**
   - 全員一律（公平）に加え、ジップ則、パレート則、正規分布、初期格差階層（富裕層/困窮層）を設定可能にする。
2. **👤 個性モジュール (Personality):**
   - 好戦的（戦闘率2倍）、消極的（待機率2倍）、弱者攻撃（資産下位を優先対戦）、強者挑戦（資産上位を優先対戦）などのエージェント行動特性（`docs/future/51_parsonal.md`）。
3. **🌐 マクロ経済8要素 循環モジュール (`docs/future/53_yardsellmodeladdfunction.md`):**
   - ①労働、②賃金、③生産、④物価、⑤消費、⑥金融、⑦政府、⑧再分配を導入し、ゼロ格差定常均衡（差異が発生しない基準系）および制度介入効果を検証。

---

## 6. プロジェクト構成

```text
.
├── docs/
│   ├── 01_Requirements.md       # 要求仕様書（現行MVP仕様 ＆ 将来機能）
│   ├── 03_ui.md                 # UI設計書
│   ├── 05_datadiagram.md        # DB設計書
│   └── future/
│       ├── 51_parsonal.md       # 個性モジュール仕様
│       └── 53_yardsellmodeladdfunction.md # マクロ経済8要素循環仕様
├── migrations/
│   └── 0003_abwds_schema.sql    # ABWDSテーブル初期化SQL
├── public/
│   ├── js/
│   │   ├── engine.js            # 決定論的シミュレーション計算エンジン (PRNG)
│   │   └── simulator-ui.js      # Canvas可視化コントローラー (個人別動態・高fps描画)
│   └── style.css                # アプリケーション共通CSS
├── scripts/
│   ├── migrate.mjs              # Turso DBマイグレーション & プリセット登録
│   └── test-engine.mjs          # エンジン単体テストスクリプト
├── src/
│   ├── app.tsx                  # Honoルーティング、SSRビュー、APIエンドポイント
│   ├── auth.ts                  # Google OAuth / JWT認証処理
│   ├── db.ts                    # LibSQL (Turso) 接続・クエリ関数
│   ├── types.ts                 # 型定義 (Scenario, Run, TurnLog等)
│   └── views/
│       ├── layout.tsx           # 共通レイアウト
│       ├── scenario_list.tsx    # シナリオ一覧
│       ├── scenario_form.tsx    # 新規作成・編集フォーム
│       ├── simulator_view.tsx   # シミュレーター実行画面 (特大Canvas)
│       ├── runs_list.tsx        # 施行履歴一覧
│       └── run_report.tsx       # 実行結果詳細レポート
├── package.json
├── tsconfig.json
└── wrangler.toml                # Cloudflare Workers設定
---

## 7. 開発環境・セットアップ

### 7.1 前提環境
- Node.js 20以降、npm
- Turso CLI と Turso アカウント（LibSQL Database）
- Cloudflare アカウント（Workers デプロイ時）
- Google Cloud プロジェクト（Googleログインを使用する場合）

### 7.2 Turso DB セットアップ
本リポジトリには `migrations/0003_abwds_schema.sql` が用意されています。

```sh
npm install
npm run db:migrate
```
※ Turso DB への接続情報が `.dev.vars` に設定されている場合、テーブルの初期化と基本プリセットシナリオが自動投入されます。

### 7.3 ローカル環境設定 (`.dev.vars`)
`.dev.vars.example` を `.dev.vars` にコピーし、接続情報を設定します。

```env
TURSO_DATABASE_URL=libsql://<database>-<organization>.turso.io
TURSO_AUTH_TOKEN=<Turso token>
GOOGLE_CLIENT_ID=<Web OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Web OAuth Client Secret>
AUTH_SECRET=<32バイト以上のランダム文字列>
APP_BASE_URL=http://localhost:8787
```

### 7.4 開発サーバーの起動
```sh
npm run dev
```
ブラウザで `http://localhost:8787` を開くと、シミュレーターのダッシュボードが表示されます。

---

## 8. Cloudflare Workers 本番デプロイ

```sh
# TypeScript型チェック
npm run typecheck

# Cloudflare Workersへデプロイ
npm run deploy
```

### Cloudflare Dashboard での環境変数設定
Cloudflare Dashboard > Workers & Pages > 対象Worker > Settings > Variables and Secrets に以下を設定します：
- `TURSO_DATABASE_URL` (Variable)
- `TURSO_AUTH_TOKEN` (Secret)
- `GOOGLE_CLIENT_ID` (Variable)
- `GOOGLE_CLIENT_SECRET` (Secret)
- `AUTH_SECRET` (Secret)
- `APP_BASE_URL` (Variable: `https://<Workerドメイン>`)


### hitory
2026/10/04 initial deploy