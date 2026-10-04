import type { Scenario, ScenarioConfig } from "../types";

export function SimulatorView(props: {
  scenario: Scenario;
  seed: number;
  isReplay: boolean;
}) {
  let cfg: ScenarioConfig = {} as ScenarioConfig;
  try {
    cfg = JSON.parse(props.scenario.config_json);
  } catch (e) {}

  return (
    <div>
      <div class="simulator-header">
        <div class="sim-title-group">
          <h1>{props.scenario.title}</h1>
          <div class="meta" style="flex-wrap: wrap; gap: 14px; font-size: 0.88rem;">
            <span>状況: <strong id="sim-status" style="color: var(--primary);">⏹ 待機中</strong></span>
            <span>進行: Turn <strong id="kpi-turn">0</strong> / <span id="kpi-max-turn">{cfg.maxTurns || 200}</span></span>
            <span>ジニ係数: <strong id="kpi-header-gini" style="font-family: var(--font-mono); color: var(--primary);">0.000</strong></span>
            <span>生存者: <strong id="kpi-header-survivors">{cfg.agentCount || 500}人</strong></span>
            <span>平均資産: <strong id="kpi-header-mean">¥{(cfg.initialWealth || 10000).toLocaleString()}</strong></span>
            <span>SEED: <input type="number" id="sim-seed" value={props.seed} style="width: 95px; background: #ffffff; border: 1px solid var(--border); color: var(--text-main); padding: 3px 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.82rem;" />
              <button id="btn-apply-seed" class="btn btn-secondary btn-sm" style="margin-left: 2px;">適用</button>
              <button id="btn-new-seed" class="btn btn-secondary btn-sm" style="margin-left: 2px;">🎲 新規</button>
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="btn-save-run" class="btn btn-primary">
            💾 Tursoへ結果を保存
          </button>
          <a href="/" class="btn btn-secondary">
            ← 一覧に戻る
          </a>
        </div>
      </div>

      <div id="save-run-msg" style="margin-bottom: 12px; font-size: 0.9rem; font-weight: 600;"></div>

      {/* ワイド表示メインコンテナ（チャート最大化） */}
      <div class="simulator-main-wide">
        <details class="info-accordion" style="margin-bottom: 12px;">
          <summary>ℹ️ ヤードセールモデル（Yard-Sale Model）とは？</summary>
          <p>
            2者の間でランダムに出会い、コイントス（勝率50%）を行って持ち金の一部をやり取りする統計物理学・数理経済学の基本モデルです。
            公平なコイントスであるにもかかわらず、<strong>再分配（税やUBI）がない場合、数学的に富が必然的に1人に独占（凝縮 / オリガルヒ化）</strong>される現象が証明されています。
            上部タブの「<strong>🧍 個人別資産動態</strong>」では横一列に並んだ個々人の資産バーと人型ピクトグラム、「<strong>🤝 ヤードセール動態</strong>」ではペア間の富の吸い上げフロー、「<strong>📉 個別資産レース</strong>」では1人が天井へ突き抜けるダイナミクスを可視化できます。
          </p>
        </details>

          <div class="viz-box">
            <div class="viz-tabs">
              <button class="viz-tab-btn active" data-tab="individuals">🧍 個人別資産動態</button>
              <button class="viz-tab-btn" data-tab="histogram">📊 資産分布ヒストグラム</button>
              <button class="viz-tab-btn" data-tab="yardsale">🤝 ヤードセール動態</button>
              <button class="viz-tab-btn" data-tab="trajectories">📉 個別資産レース</button>
              <button class="viz-tab-btn" data-tab="lorenz">📐 ローレンツ曲線</button>
              <button class="viz-tab-btn" data-tab="trend">📈 ジニ推移グラフ</button>
            </div>
            {/* 個人別動態用サブコントロール */}
            <div class="viz-sub-bar" id="sub-bar-individuals">
              <div class="sub-bar-left">
                <span class="sub-bar-label">並び順:</span>
                <div class="btn-group btn-group-sm">
                  <button type="button" class="btn btn-primary btn-sm active" id="btn-indiv-sort-wealth">📊 富の昇順（パレード）</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-indiv-sort-id">🔢 エージェントID順（上下動）</button>
                </div>
              </div>
              <div class="sub-bar-right">
                <span class="sub-bar-label">表示密度:</span>
                <select id="select-indiv-sample" class="form-control form-control-sm" style="width: auto; padding: 3px 8px; font-size: 0.8rem; display: inline-block;">
                  <option value="100" selected>代表 100人（アイコン標準）</option>
                  <option value="all">全員表示 ({props.scenario.config?.agentCount || 500}人)</option>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-indiv-clear-track" style="display: none; margin-left: 6px;">📍 追跡ピン解除</button>
              </div>
            </div>
            <div class="canvas-wrapper">
              <canvas id="sim-canvas" width="1200" height="520"></canvas>
            </div>
          </div>

          <div class="control-bar">
            <div class="btn-group">
              <button id="btn-jump-start" class="btn btn-secondary btn-sm" title="先頭へ">|&lt;&lt;</button>
              <button id="btn-step-prev10" class="btn btn-secondary btn-sm" title="10前へ">&lt;&lt; 10</button>
              <button id="btn-step-prev" class="btn btn-secondary btn-sm" title="1前へ">&lt; 1</button>
              <button id="btn-play" class="btn btn-primary" style="min-width: 100px;">
                <span class="icon">▶</span> 再生
              </button>
              <button id="btn-step-next" class="btn btn-secondary btn-sm" title="1次へ">1 &gt;</button>
              <button id="btn-step-next10" class="btn btn-secondary btn-sm" title="10次へ">10 &gt;&gt;</button>
              <button id="btn-jump-end" class="btn btn-secondary btn-sm" title="最後へ">&gt;&gt;|</button>
              <button id="btn-reset" class="btn btn-secondary btn-sm" title="リセット">🔄</button>
            </div>

            <div class="speed-control">
              <span>速度:</span>
              <input type="range" id="speed-slider" min="1" max="100" defaultValue="70" />
            </div>
          </div>
        {/* 標準では非表示の詳細情報ドロワー（設定パラメータ、リアルタイム指標、階層別資産シェア、イベントログ） */}
        <details class="sim-details-drawer">
          <summary class="sim-details-toggle">
            <span>📋 設定パラメータ・詳細指標 (KPI)・イベントログを表示</span>
            <span class="toggle-hint">クリックで開閉</span>
          </summary>
          <div class="sim-details-grid">
            <div class="sim-panel">
              <h2>環境設定パラメータ</h2>
              <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.8;">
                <p><strong>エージェント数 (人口):</strong> {cfg.agentCount || 500} 人</p>
                <p><strong>初期資産:</strong> ¥{(cfg.initialWealth || 10000).toLocaleString()}</p>
                <p><strong>最大ターン数:</strong> {cfg.maxTurns || 200} ターン</p>
                <p><strong>取引ルール:</strong> ヤードセール取引（50%コイントス）</p>
              </div>
              <div style="margin-top: 14px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border); font-size: 0.78rem; color: var(--text-muted);">
                🚀 <strong>拡張予定:</strong> 「初期資産分布」「個性」、およびマクロ経済8要素（①労働〜⑧再分配）を順次追加予定
              </div>
            </div>

            <div class="sim-panel">
              <h2>リアルタイム指標 (KPI)</h2>

              <div class="kpi-card" style="margin-bottom: 12px; border-left: 4px solid var(--primary);">
                <div class="kpi-label">ジニ係数 (Gini Index)</div>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span id="kpi-gini" class="kpi-value">0.000</span>
                  <span id="kpi-gini-diff" style="font-size: 0.85rem; font-family: var(--font-mono); color: var(--text-dim);">(+0.000)</span>
                </div>
                <div class="kpi-sub">0: 完全平等 / 0.4以上: 警戒水準</div>
              </div>

              <div class="kpi-card" style="margin-bottom: 12px; border-left: 4px solid var(--success);">
                <div class="kpi-label">生存人数 / 残存率</div>
                <div id="kpi-survivors" class="kpi-value">{cfg.agentCount || 500} 人</div>
                <div id="kpi-dropout-rate" class="kpi-sub">脱落: 0人 (0.0%)</div>
              </div>

              <div class="kpi-row">
                <div class="kpi-card">
                  <div class="kpi-label">平均資産</div>
                  <div id="kpi-mean-wealth" class="kpi-value" style="font-size: 1.1rem;">¥{(cfg.initialWealth || 10000).toLocaleString()}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">資産中央値</div>
                  <div id="kpi-median-wealth" class="kpi-value" style="font-size: 1.1rem;">¥{(cfg.initialWealth || 10000).toLocaleString()}</div>
                </div>
              </div>

              <h2 style="margin-top: 20px;">階層別資産シェア</h2>
              <div class="kpi-card" style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="kpi-label">上位 1% (Top 1%)</span>
                  <strong id="kpi-top1" style="font-family: var(--font-mono);">1.0%</strong>
                </div>
              </div>
              <div class="kpi-card" style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="kpi-label">上位 10% (Top 10%)</span>
                  <strong id="kpi-top10" style="font-family: var(--font-mono);">10.0%</strong>
                </div>
              </div>
              <div class="kpi-card" style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="kpi-label">下位 50% (Bottom 50%)</span>
                  <strong id="kpi-bottom50" style="font-family: var(--font-mono);">50.0%</strong>
                </div>
              </div>
            </div>

            <div class="sim-panel">
              <h2>イベントログ</h2>
              <div id="sim-event-logs" class="log-box" style="height: 380px;">
                <div class="log-item">シミュレーション準備完了。</div>
              </div>
            </div>
          </div>
        </details>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('DOMContentLoaded', () => {
              const scenarioConfig = ${JSON.stringify(cfg)};
              window.simulatorApp = new window.SimulatorUI({
                scenarioId: "${props.scenario.id}",
                config: scenarioConfig,
                seed: ${props.seed},
                isReplay: ${props.isReplay ? "true" : "false"}
              });
            });
          `
        }}
      />
    </div>
  );
}

