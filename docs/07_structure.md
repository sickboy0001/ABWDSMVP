**Hono（Webサーバー）** ＋ **Turso（データベース）** ＋ **クライアント（ブラウザ）** でシミュレーションを実行する構成では、「サーバー側（データ管理・API・初期描画）」**と**「クライアント側（高速なシミュレーション計算・リアルタイムUI更新）」の責務を完全に分離するのが最も美しく効率的な設計になります。

---

## 1. システム全体構成図

クライアント側でシミュレーションを実行するため、ブラウザ上で100%同一の結果を再現できる**JavaScript/TypeScript製の決定論的計算エンジン**を動かします。

```text
  【ブラウザ (クライアント)】                           【Hono サーバー】               【Turso (DB)】
+------------------------------------+             +-----------------------------+        +--------------------+
|  1. UI設定・パラメータ入力        |             |                             |        |                    |
|  2. シミュレーション計算エンジン  |             |  1. HTML/JSの配信           |        |                    |
|     (Web Workerでバックグラウンド)  |             |  2. 認証・ユーザー管理      |        |                    |
|  3. Chart.js/Canvas で描画         |             |  3. シナリオ保存・取得 API  |        |                    |
|  4. 結果のサマリー抽出 (KPI)       | ─── JSON ──► |  4. 実行ログ記録 API       | ─────► |  ・users           |
+------------------------------------+             +-----------------------------+        |  ・scenarios        |
                                                                                          |  ・simulation_runs |
                                                                                          |  ・turn_logs       |
                                                                                          +--------------------+

```

### なぜこの構成なのか？

1. **画面の非同期処理 (Web Worker)**: シミュレーション計算（5万人のループ処理）をメインスレッドから切り離した「Web Worker」で行うことで、計算中もUIの操作やアニメーションが一切カクつきません。
2. **Tursoの容量節約**: クライアント側で1,000ターン計算した後、**「最終KPI」や「10ターンごとの集計データ」だけをHono経由でTursoに送信**して保存します。

---

## 2. 実装技術スタック

* **サーバー（Hono）**: APIエンドポイント（シナリオ保存・読み込み） ＋ 静的ファイル配信
* **データベース（Turso）**: `@libsql/client` または `drizzle-orm` を使用
* **UI構想（フロントエンド）**:
* パラメータ入力 & 初期表示: **htmx** または **Alpine.js**（軽量でHono/jsxと相性抜群）
* 時系列・ヒストグラム描画: **Chart.js** または **Canvas API**


* **シミュレーションエンジン**: 純粋な **TypeScript (Web Worker)**

---

## 3. Recommended ファイル・ディレクトリ構成

プロジェクト全体を管理しやすい Monorepo / Single Repo 構造の構成例です。

```text
abwds-app/
├── package.json
├── tsconfig.json
├── drizzle.config.ts          # Turso (Drizzle ORM) 用設定
├── .env                       # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
│
├── src/
│   ├── index.ts               # Hono エントリーポイント (サーバー起動)
│   ├── db/                    # Turso 接続設定 & スキーマ定義
│   │   ├── index.ts           # @libsql/client 設定
│   │   └── schema.ts          # Drizzle スキーマ定義 (users, scenarios, etc.)
│   │
│   ├── routes/                # Hono のルーティング (API エンドポイント)
│   │   ├── auth.ts            # ユーザー認証 API
│   │   ├── scenarios.ts       # シナリオ CRUD API
│   │   └── runs.ts            # 実行結果保存 API
│   │
│   ├── views/                 # Hono/JSX によるページテンプレート (HTML出力)
│   │   ├── layout.tsx         # 共通レイアウト (CSS/JS読み込み)
│   │   └── dashboard.tsx      # シミュレーションメイン画面
│   │
│   └── public/                # クライアント側で動くフロントエンド資産
│       ├── css/
│       │   └── style.css
│       └── js/
│           ├── main.js        # UI操作・チャート描画・Worker呼び出し制御
│           ├── worker.js      # ★ Web Worker (シミュレーション計算の本体)
│           └── simulator/     # シミュレーションロジック (TypeScriptからビルド)
│               ├── rng.ts     # 決定論的乱数生成器 (LCG/Xorshift)
│               ├── agent.ts   # エージェントモデル定義
│               ├── rules.ts   # 各種モジュール (税金, UBI, マッチング)
│               └── engine.ts  # メイン計算ループ

```

---

## 4. データ連携フロー（処理の流れ）

### A. シミュレーション実行 & 保存のステップ

1. **画面読み込み**: ユーザーがブラウザでアクセスすると、Honoが `dashboard.tsx` (HTML) と `worker.js` (計算エンジン) を返します。
2. **実行開始**: ユーザーが「再生」を押すと、`main.js` が `worker.js` に「シード値」と「パラメータJSON」を渡してWeb Workerを起動します。
3. **ブラウザ内で計算**: `worker.js` が1ターンずつ計算し、`main.js` にターン毎の集計データを送ります。`main.js` はそれを受け取りリアルタイムで Chart.js に描画します。
4. **結果保存**: 計算完了（または一時停止）時、`main.js` は集計ログ（KPIやシード値）を Hono の `/api/runs` エンドポイントへ `POST`（JSON送信）します。
5. **Tursoへ書き込み**: Hono サーバーが受け取ったデータを Turso DB へ保存します。

---

## 5. 主要コードの基本設計例

### ① クライアント（計算エンジン Worker）の概要

`public/js/worker.js`

```typescript
// 決定論的乱数(Seedable RNG)を使用した計算ループ
import { SeededRNG } from './simulator/rng';
import { SimulationEngine } from './simulator/engine';

self.onmessage = (e) => {
  const { config, seed_value, max_turns } = e.data;
  const rng = new SeededRNG(seed_value);
  const engine = new SimulationEngine(config, rng);

  for (let turn = 1; turn <= max_turns; turn++) {
    const turnResult = engine.step(); // 1ターン進める
    
    // 10ターンごと、または重要イベント時にメインUIへ進捗送信
    if (turn % 10 === 0) {
      self.postMessage({ type: 'TICK', turn, kpi: turnResult.kpi });
    }
  }

  // 終了時に結果サマリーを返却
  self.postMessage({ type: 'COMPLETE', summary: engine.getSummary() });
};

```

### ② Hono（Tursoデータ保存 API）の概要

`src/routes/runs.ts`

```typescript
import { Hono } from 'hono';
import { db } from '../db';
import { simulationRuns, turnLogs } from '../db/schema';

const app = new Hono();

// シミュレーション実行結果の保存
app.post('/', async (c) => {
  const body = await c.req.json();
  const { scenario_id, user_id, seed_value, logs } = body;

  // 1. 実行レコードを作成
  const [run] = await db.insert(simulationRuns).values({
    scenarioId: scenario_id,
    userId: user_id,
    seedValue: seed_value,
  }).returning();

  // 2. ターンごとの集計ログを一括保存 (Turso)
  const logRecords = logs.map(l => ({
    runId: run.id,
    turn: l.turn,
    giniIndex: l.gini,
    survivorCount: l.survivors,
    meanWealth: l.mean,
    medianWealth: l.median,
  }));
  
  await db.insert(turnLogs).values(logRecords);

  return c.json({ success: true, runId: run.id });
});

export default app;

```

この「**Hono + Web Worker + Turso**」のディレクトリ・役割構成を採用することで、フロントエンドとバックエンドのコード境界がクリアになり、拡張性が高く超高速に動作するWebアプリを構築できます。


Tursoの操作にDrizzleを使わず、標準の `@libsql/client` (SQL直書き) を利用する構成ですね。シンプルで軽量なライブラリ構成になり、Honoとの親和性も抜群です。

クライアント側の計算の要となる **Web Worker (シミュレーション計算エンジン)** について、メインスレッド（画面UI）との役割分担、通信プロトコル、具体的なコード実装の仕様を提示します。

---

### 1. メインスレッドと Web Worker の役割分担

画面描画（Chart.js等）やUI操作と、計算処理を別スレッドに分離することで、**5万人のエージェント計算中であっても画面が一切カクつかず（60fps維持）、リアルタイムにパラメータ介入できる**構造を作ります。

* **メインスレッド (`main.js`)**:
* ユーザー入力（再生・一時停止・パラメータ変更）の受領
* Workerへのメッセージ送信
* Workerからの集計データ受信と Chart.js / DOM の更新
* シミュレーション終了時の Turso 保存 API (`/api/runs`) への送信


* **Web Worker (`worker.js`)**:
* 決定論的乱数器 (PRNG) の初期化
* ターンループの実行（行動決定・対戦・税制・脱落判定）
* 毎ターン（またはNターンごと）の KPI（ジニ係数・平均資産等）の計算とメインスレッドへの転送



---

### 2. メッセージ通信仕様 (Protocol Specification)

`postMessage` 経由でメインスレッドと Worker 間でやり取りするイベント構造を定義します。

#### A. メインスレッド ➔ Worker (指示コマンド)

```typescript
// 1. シミュレーション初期化＆開始
type StartMessage = {
  type: 'START';
  payload: {
    seed: number;            // 例: 98237410928471
    maxTurns: number;        // 例: 1000
    agentCount: number;      // 例: 10000
    config: SimulationConfig;// ルール設定（税率、UBI等）
    interval: number;        // リアルタイム描画の間隔 (例: 5ターンごと)
  };
};

// 2. 一時停止 / 再開 / ステップ実行
type ControlMessage = 
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STEP' } // 1ターンだけコマ送り
  | { type: 'UPDATE_CONFIG'; payload: Partial<SimulationConfig> }; // 実行中のパラメータ介入

```

#### B. Worker ➔ メインスレッド (状態・集計データ通知)

```typescript
// 1. ターン進捗データ (描画用)
type TickMessage = {
  type: 'TICK';
  payload: {
    turn: number;
    kpi: {
      gini: number;          // ジニ係数
      survivors: number;     // 残存人数
      meanWealth: number;    // 平均資産
      medianWealth: number;  // 資産中央値
      top1Share: number;     // Top1%シェア
      histogram: number[];   // 資産階層別分布 (バーチャート用)
    };
  };
};

// 2. 完了通知 (DB保存用サマリー付き)
type CompleteMessage = {
  type: 'COMPLETE';
  payload: {
    finalTurn: number;
    allTurnLogs: KPILog[];   // 全ターンの軽量集計ログ (Turso保存用)
  };
};

```

---

### 3. 実装コード仕様案

#### ① 決定論的乱数生成器 (PRNG: Mulberry32)

`public/js/simulator/prng.js`

> ※ JavaScript標準の `Math.random()` はシード固定ができないため、軽量で高速な擬似乱数アルゴリズムを自作して使用します。

```javascript
export class Mulberry32 {
  constructor(seed) {
    this.state = seed;
  }

  // 0 以上 1 未満の決定論的乱数を返す
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

```

#### ② シミュレーション Web Worker 本体

`public/js/worker.js`

```javascript
import { Mulberry32 } from './simulator/prng.js';

let isRunning = false;
let isPaused = false;
let currentTurn = 0;
let maxTurns = 1000;
let rng = null;
let config = {};
let agents = [];
let turnLogs = [];

// メインスレッドからのコマンド受信
self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      initSimulation(payload);
      runLoop();
      break;
    case 'PAUSE':
      isPaused = true;
      break;
    case 'RESUME':
      if (isPaused) {
        isPaused = false;
        runLoop();
      }
      break;
    case 'UPDATE_CONFIG':
      // リアルタイム制度介入 (例: 途中でUBIを増額)
      config = { ...config, ...payload };
      break;
  }
};

function initSimulation(params) {
  currentTurn = 0;
  maxTurns = params.maxTurns;
  config = params.config;
  rng = new Mulberry32(params.seed);
  turnLogs = [];
  
  // エージェント初期化
  agents = Array.from({ length: params.agentCount }, (_, i) => ({
    id: i,
    wealth: config.initialWealth || 10000,
    isAlive: true
  }));
}

// 非同期ループでメインスレッドをブロックせずに連動
async function runLoop() {
  isRunning = true;

  while (currentTurn < maxTurns && !isPaused) {
    currentTurn++;
    
    // 1. ターン内処理 (対戦・税金・UBI・脱落判定)
    processTurn(agents, config, rng);

    // 2. KPI集計
    const kpi = calculateKPI(agents);
    turnLogs.push({ turn: currentTurn, ...kpi });

    // 3. メインスレッドへ10ターンごとに描画データを送信
    if (currentTurn % 10 === 0 || currentTurn === maxTurns) {
      self.postMessage({
        type: 'TICK',
        payload: { turn: currentTurn, kpi }
      });
      // メインスレッド側の描画処理に配慮し、わずかに非同期スキップを入れる
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (currentTurn >= maxTurns) {
    self.postMessage({
      type: 'COMPLETE',
      payload: { finalTurn: currentTurn, allTurnLogs: turnLogs }
    });
  }
}

function processTurn(agents, config, rng) {
  // --- 1. UBI支給 ---
  if (config.ubiEnabled) {
    for (let a of agents) {
      if (a.isAlive) a.wealth += config.ubiAmount;
    }
  }
  
  // --- 2. ランダムマッチング & 賭博取引 ---
  // rng.next() を使用して完全に再現可能な計算を実施
  // (省略)
}

function calculateKPI(agents) {
  // ジニ係数・生存者数の計算ロジック
  // (省略)
  return { gini: 0.42, survivors: 8420, meanWealth: 12500 };
}

```

#### ③ メインスレッド側の受け取り & チャート更新制御

`public/js/main.js`

```javascript
// Web Worker の生成
const worker = new Worker('/js/worker.js', { type: 'module' });

// Workerからのメッセージ受信
worker.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'TICK') {
    // 画面のKPI数値テキストを更新
    document.getElementById('gini-val').innerText = payload.kpi.gini.toFixed(3);
    // Chart.js などのグラフにデータ点を追加・再描画
    updateCharts(payload.turn, payload.kpi);
  }

  if (type === 'COMPLETE') {
    console.log('シミュレーション完了。Tursoへ結果を送信します。');
    // Hono API 経由で Turso (@libsql/client) へ保存
    saveRunToTurso(payload.allTurnLogs);
  }
};

// ボタン操作イベント
document.getElementById('btn-start').addEventListener('click', () => {
  worker.postMessage({
    type: 'START',
    payload: {
      seed: 98237410928471,
      maxTurns: 1000,
      agentCount: 10000,
      config: { ubiEnabled: true, ubiAmount: 500 }
    }
  });
});

// 途中からのパラメータ介入 (例: UBI変更スライダー)
document.getElementById('input-ubi').addEventListener('change', (e) => {
  worker.postMessage({
    type: 'UPDATE_CONFIG',
    payload: { ubiAmount: Number(e.target.value) }
  });
});

async function saveRunToTurso(logs) {
  await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: 98237410928471, logs })
  });
}

```

---

### 4. この仕様の設計的なメリット

1. **完全なスレッド分離**: `Mulberry32` 乱数生成器を含む重いロジックが Worker 内に閉じ閉じられているため、UI描画ライブラリがどれだけ重くなっても計算精度や速度に影響しません。
2. **途中介入（What-If）のリアルタイム反映**: 実行中に `UPDATE_CONFIG` を投げることで、Worker 内のオブジェクトプロパティが即座に更新され、シミュレーションを止めることなく制度変更の効果をテストできます。
3. **通信の軽量化**: 毎ターンデータを送るとメッセージパスのオーバーヘッドが大きくなるため、`currentTurn % 10 === 0` のように描画用データの転送頻度を間引くことで、高速化（1000ターンをわずか数秒で完走）できます。