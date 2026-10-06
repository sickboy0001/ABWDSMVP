import type { SimulationRun } from "../types";

export function CompareView(props: {
  run1: SimulationRun;
  run2: SimulationRun;
}) {
  const r1 = props.run1;
  const r2 = props.run2;
  const cfg1 = r1.scenario_config || ({} as any);
  const cfg2 = r2.scenario_config || ({} as any);
  const sum1 = r1.summary || ({} as any);
  const sum2 = r2.summary || ({} as any);

  const pop1 = cfg1.agentCount ?? sum1.initialSurvivors ?? "-";
  const pop2 = cfg2.agentCount ?? sum2.initialSurvivors ?? "-";
  const wealth1 = cfg1.initialWealth ?? "-";
  const wealth2 = cfg2.initialWealth ?? "-";
  const maxTurns1 = r1.max_turns;
  const maxTurns2 = r2.max_turns;

  const isSameSeed = r1.seed_value === r2.seed_value;
  const isSameCondition = pop1 === pop2 && wealth1 === wealth2 && maxTurns1 === maxTurns2;

  const betRatio1Str = cfg1.betRatio !== undefined ? `${Math.round(cfg1.betRatio * 100)}%` : "-";
  const betRatio2Str = cfg2.betRatio !== undefined ? `${Math.round(cfg2.betRatio * 100)}%` : "-";

  const betRule1Str = cfg1.betRule === "fixed_ratio" ? "fixed_ratio (敗者)" : cfg1.betRule === "min_wealth" ? "min_wealth (弱者)" : (cfg1.betRule || "-");
  const betRule2Str = cfg2.betRule === "fixed_ratio" ? "fixed_ratio (敗者)" : cfg2.betRule === "min_wealth" ? "min_wealth (弱者)" : (cfg2.betRule || "-");

  const gini1 = sum1.finalGini !== undefined ? sum1.finalGini : null;
  const gini2 = sum2.finalGini !== undefined ? sum2.finalGini : null;
  const diffGini = (gini1 !== null && gini2 !== null) ? (gini2 - gini1) : null;

  const surv1 = sum1.finalSurvivors !== undefined ? sum1.finalSurvivors : null;
  const surv2 = sum2.finalSurvivors !== undefined ? sum2.finalSurvivors : null;
  const diffSurv = (surv1 !== null && surv2 !== null) ? (surv2 - surv1) : null;

  return (
    <div style="max-width: 1300px; margin: 0 auto; padding-bottom: 50px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <a href="/runs" class="btn btn-secondary btn-sm" style="margin-bottom: 8px; display: inline-block;">
            ← 施行履歴一覧へ戻る
          </a>
          <h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 4px 0;">
            ⚖️ シミュレーション施行比較
          </h1>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">
            初期条件が同一の2つの施行を並べ、掛け金比率やルールの違いによる個別資産動態（ペン・パレード）と格差・所持金の差異を比較します。
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href={`/scenarios/${r1.scenario_id}/run?seed=${r1.seed_value}&replay=1`} class="btn btn-secondary btn-sm">
            施行A リプレイ
          </a>
          <a href={`/scenarios/${r2.scenario_id}/run?seed=${r2.seed_value}&replay=1`} class="btn btn-secondary btn-sm">
            施行B リプレイ
          </a>
        </div>
      </div>

      {!isSameCondition && (
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 10px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 0.85rem; color: #991b1b;">
          ⚠️ <strong>注意:</strong> 初期条件（人口・資産・ターン数）が完全一致していません。
        </div>
      )}

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px;">
        <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 0.82rem; padding: 4px 10px;">
          👥 初期人口: <strong>{pop1}人</strong>
        </span>
        <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 0.82rem; padding: 4px 10px;">
          💰 初期資産: <strong>¥{Number(wealth1).toLocaleString()}</strong>
        </span>
        <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 0.82rem; padding: 4px 10px;">
          ⏱️ 最大ターン: <strong>{maxTurns1}T</strong>
        </span>
        <span class="badge" style={isSameSeed ? "background: #dcfce7; color: #166534; font-size: 0.82rem; padding: 4px 10px;" : "background: #fef3c7; color: #92400e; font-size: 0.82rem; padding: 4px 10px;"}>
          🎲 シード値: <strong>{isSameSeed ? `同一シード (${r1.seed_value})` : `異シード (A: ${r1.seed_value} / B: ${r2.seed_value})`}</strong>
        </span>
      </div>

      {/* 2カラム並列サマリーカード */}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div class="sim-panel" style="border-top: 4px solid #2563eb;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge" style="background: #dbeafe; color: #1e40af; font-weight: 700; margin-bottom: 4px;">施行 A</span>
              <h2 style="font-size: 1.05rem; margin: 4px 0 2px 0; border: none; padding: 0; color: var(--text-main);">
                {r1.scenario_title || r1.scenario_id}
              </h2>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">#{r1.id.slice(0, 8)}</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 0.85rem;">
            <div>掛け金比率: <strong style="color: #2563eb; font-size: 1.05rem;">{betRatio1Str}</strong></div>
            <div>ルール: <span style="font-size: 0.8rem; color: var(--text-muted);">{betRule1Str}</span></div>
            <div>最終ジニ係数: <strong style="font-family: var(--font-mono); font-size: 1.05rem;">{gini1 !== null ? gini1.toFixed(3) : "-"}</strong></div>
            <div>生存人数: <strong>{surv1 !== null ? `${surv1}人` : "-"}</strong></div>
          </div>
        </div>

        <div class="sim-panel" style="border-top: 4px solid #7c3aed;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge" style="background: #ede9fe; color: #5b21b6; font-weight: 700; margin-bottom: 4px;">施行 B</span>
              <h2 style="font-size: 1.05rem; margin: 4px 0 2px 0; border: none; padding: 0; color: var(--text-main);">
                {r2.scenario_title || r2.scenario_id}
              </h2>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">#{r2.id.slice(0, 8)}</span>
            </div>
            {diffGini !== null && (
              <div style="text-align: right;">
                <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">格差差分 (B - A)</span>
                <span class="badge" style={diffGini > 0 ? "background: #fee2e2; color: #b91c1c; font-size: 0.85rem;" : "background: #dcfce7; color: #15803d; font-size: 0.85rem;"}>
                  Δ ジニ {diffGini >= 0 ? `+${diffGini.toFixed(3)}` : diffGini.toFixed(3)}
                </span>
              </div>
            )}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 0.85rem;">
            <div>掛け金比率: <strong style="color: #7c3aed; font-size: 1.05rem;">{betRatio2Str}</strong></div>
            <div>ルール: <span style="font-size: 0.8rem; color: var(--text-muted);">{betRule2Str}</span></div>
            <div>最終ジニ係数: <strong style="font-family: var(--font-mono); font-size: 1.05rem;">{gini2 !== null ? gini2.toFixed(3) : "-"}</strong></div>
            <div>生存人数: <strong>{surv2 !== null ? `${surv2}人` : "-"}</strong></div>
          </div>
        </div>
      </div>
      {/* コントロールバー */}
      <div class="control-bar" style="margin-bottom: 16px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div class="btn-group">
            <button type="button" id="btn-comp-jump-start" class="btn btn-secondary btn-sm" title="最初へ">|&lt;&lt;</button>
            <button type="button" id="btn-comp-step-prev10" class="btn btn-secondary btn-sm" title="10前へ">&lt;&lt; 10</button>
            <button type="button" id="btn-comp-step-prev" class="btn btn-secondary btn-sm" title="1前へ">&lt; 1</button>
            <button type="button" id="btn-comp-play" class="btn btn-primary" style="min-width: 110px;">
              <span class="icon">▶</span> 同期再生
            </button>
            <button type="button" id="btn-comp-step-next" class="btn btn-secondary btn-sm" title="1次へ">1 &gt;</button>
            <button type="button" id="btn-comp-step-next10" class="btn btn-secondary btn-sm" title="10次へ">10 &gt;&gt;</button>
            <button type="button" id="btn-comp-jump-end" class="btn btn-secondary btn-sm" title="最後へ">&gt;&gt;|</button>
            <button type="button" id="btn-comp-reset" class="btn btn-secondary btn-sm" title="リセット">🔄</button>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="comp-turn-display" style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; min-width: 120px;">
              Turn 0 / {maxTurns1}
            </span>
            <input type="range" id="comp-turn-slider" min="0" max={maxTurns1} value="0" style="width: 160px; accent-color: var(--primary);" />
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          {/* 表示モード切替: 積み上げ / 並列 / 重ね合わせ */}
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">グラフ形式:</span>
            <div class="btn-group btn-group-sm">
              <button type="button" id="btn-mode-stacked" class="btn btn-primary btn-sm" title="1本の棒でAとBを積み上げ">📊 積み上げ</button>
              <button type="button" id="btn-mode-grouped" class="btn btn-secondary btn-sm" title="エージェントごとにAとBの棒を並べる">⏸️ 並列</button>
              <button type="button" id="btn-mode-overlay" class="btn btn-secondary btn-sm" title="同じ位置に半透明で重ね合わせ">🔲 重ね合わせ</button>
            </div>
          </div>

          {/* 並び順 */}
          <div class="btn-group btn-group-sm">
            <button type="button" id="btn-comp-sort-wealth" class="btn btn-primary btn-sm">富の昇順</button>
            <button type="button" id="btn-comp-sort-id" class="btn btn-secondary btn-sm">ID順</button>
          </div>

          <select id="select-comp-sample" class="form-control form-control-sm" style="width: auto; padding: 3px 8px; font-size: 0.8rem;">
            <option value="100" selected>代表 100人</option>
            <option value="all">全員表示 ({pop1}人)</option>
          </select>

          <div class="speed-control" style="font-size: 0.8rem;">
            <span>速度:</span>
            <input type="range" id="comp-speed-slider" min="1" max="100" value="60" style="width: 60px;" />
          </div>
        </div>
      </div>
      {/* 統合単一チャートパネル */}
      <div class="sim-panel" style="padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <h2 style="margin: 0; padding: 0; border: none; font-size: 1.05rem; color: var(--text-main);">
              🧍 個別資産動態・積み上げ比較チャート
            </h2>
            <div style="display: flex; gap: 12px; font-size: 0.82rem;">
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: #2563eb; border-radius: 2px;"></span>
                <strong>施行 A ({betRatio1Str})</strong>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: #7c3aed; border-radius: 2px;"></span>
                <strong>施行 B ({betRatio2Str})</strong>
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 16px; font-size: 0.85rem; font-family: var(--font-mono); flex-wrap: wrap;">
            <span>Gini: <strong id="kpi-live-gini-1" style="color: #2563eb;">-</strong> vs <strong id="kpi-live-gini-2" style="color: #7c3aed;">-</strong> (<strong id="kpi-diff-gini">-</strong>)</span>
            <span>生存: <strong id="kpi-live-surv-1">-</strong> vs <strong id="kpi-live-surv-2">-</strong> (<strong id="kpi-diff-surv">-</strong>)</span>
            <span>最高資産: <strong id="kpi-live-max-1" style="color: #b45309;">-</strong> vs <strong id="kpi-live-max-2" style="color: #b45309;">-</strong> (<strong id="kpi-diff-max">-</strong>)</span>
          </div>
        </div>

        <div style="width: 100%; aspect-ratio: 16 / 7; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
          <canvas id="canvas-compare-main" width="1200" height="520" style="width: 100%; height: 100%; display: block;"></canvas>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 8px 0 0 0; text-align: center;">
          💡 棒にマウスを合わせると、各エージェントの施行A所持金・施行B所持金・差異（B - A）がツールチップで表示されます。
        </p>
      </div>
      {/* 所持金額 & 格差の詳細比較テーブル */}
      <div class="sim-panel" style="margin-top: 30px;">
        <h2>📊 所持金額 &amp; 格差指標（最終状態）の詳細比較</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>比較指標</th>
              <th>施行 A ({betRatio1Str})</th>
              <th>施行 B ({betRatio2Str})</th>
              <th>差異 (B - A)</th>
              <th>考察・影響</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>最終ジニ係数</strong></td>
              <td style="font-family: var(--font-mono); font-weight: 700;">{gini1 !== null ? gini1.toFixed(3) : "-"}</td>
              <td style="font-family: var(--font-mono); font-weight: 700;">{gini2 !== null ? gini2.toFixed(3) : "-"}</td>
              <td style={`font-family: var(--font-mono); font-weight: 700; color: ${diffGini && diffGini > 0 ? "var(--danger)" : "var(--success)"};`}>
                {diffGini !== null ? (diffGini >= 0 ? `+${diffGini.toFixed(3)}` : diffGini.toFixed(3)) : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">
                {diffGini !== null && diffGini > 0 ? "掛け金比率等の拡大により富の集中が加速" : "格差が緩和または同等"}
              </td>
            </tr>
            <tr>
              <td><strong>生存人数 / 生存率</strong></td>
              <td>{surv1 !== null ? `${surv1}人 (${((surv1 / Number(pop1)) * 100).toFixed(1)}%)` : "-"}</td>
              <td>{surv2 !== null ? `${surv2}人 (${((surv2 / Number(pop2)) * 100).toFixed(1)}%)` : "-"}</td>
              <td style="font-family: var(--font-mono);">
                {diffSurv !== null ? (diffSurv >= 0 ? `+${diffSurv}人` : `${diffSurv}人`) : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">
                {diffSurv !== null && diffSurv < 0 ? "より多くのエージェントが破産・脱落" : "-"}
              </td>
            </tr>
            <tr>
              <td><strong>上位1% 資産シェア</strong></td>
              <td style="font-family: var(--font-mono);">{sum1.top1Share !== undefined ? `${sum1.top1Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">{sum2.top1Share !== undefined ? `${sum2.top1Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">
                {sum1.top1Share !== undefined && sum2.top1Share !== undefined
                  ? `${(sum2.top1Share - sum1.top1Share >= 0 ? "+" : "")}${(sum2.top1Share - sum1.top1Share).toFixed(1)}%`
                  : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">最富裕層への富の凝縮割合</td>
            </tr>
            <tr>
              <td><strong>上位10% 資産シェア</strong></td>
              <td style="font-family: var(--font-mono);">{sum1.top10Share !== undefined ? `${sum1.top10Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">{sum2.top10Share !== undefined ? `${sum2.top10Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">
                {sum1.top10Share !== undefined && sum2.top10Share !== undefined
                  ? `${(sum2.top10Share - sum1.top10Share >= 0 ? "+" : "")}${(sum2.top10Share - sum1.top10Share).toFixed(1)}%`
                  : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">上位1割が占める社会全体の資産比率</td>
            </tr>
            <tr>
              <td><strong>下位50% 資産シェア</strong></td>
              <td style="font-family: var(--font-mono);">{sum1.bottom50Share !== undefined ? `${sum1.bottom50Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">{sum2.bottom50Share !== undefined ? `${sum2.bottom50Share.toFixed(1)}%` : "-"}</td>
              <td style="font-family: var(--font-mono);">
                {sum1.bottom50Share !== undefined && sum2.bottom50Share !== undefined
                  ? `${(sum2.bottom50Share - sum1.bottom50Share >= 0 ? "+" : "")}${(sum2.bottom50Share - sum1.bottom50Share).toFixed(1)}%`
                  : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">庶民層に残されたパイの大きさ</td>
            </tr>
            <tr>
              <td><strong>資産中央値</strong></td>
              <td style="font-family: var(--font-mono);">¥{sum1.finalMedianWealth ? Math.round(sum1.finalMedianWealth).toLocaleString() : "-"}</td>
              <td style="font-family: var(--font-mono);">¥{sum2.finalMedianWealth ? Math.round(sum2.finalMedianWealth).toLocaleString() : "-"}</td>
              <td style="font-family: var(--font-mono);">
                {sum1.finalMedianWealth && sum2.finalMedianWealth
                  ? `${sum2.finalMedianWealth - sum1.finalMedianWealth >= 0 ? "+" : ""}¥${Math.round(sum2.finalMedianWealth - sum1.finalMedianWealth).toLocaleString()}`
                  : "-"}
              </td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">中間層の典型的な所持金額</td>
            </tr>
          </tbody>
        </table>
      </div>

      <script
        type="module"
        dangerouslySetInnerHTML={{
          __html: `
            import { CompareUI } from "/js/compare-ui.js";

            const run1Data = {
              id: "${r1.id}",
              title: "${(r1.scenario_title || r1.scenario_id).replace(/"/g, '\\"')}",
              seed_value: ${r1.seed_value},
              max_turns: ${r1.max_turns},
              config: ${JSON.stringify(cfg1)}
            };
            const run2Data = {
              id: "${r2.id}",
              title: "${(r2.scenario_title || r2.scenario_id).replace(/"/g, '\\"')}",
              seed_value: ${r2.seed_value},
              max_turns: ${r2.max_turns},
              config: ${JSON.stringify(cfg2)}
            };

            function init() {
              window.compareApp = new CompareUI({
                run1: run1Data,
                run2: run2Data
              });
            }

            if (document.readyState === "loading") {
              document.addEventListener("DOMContentLoaded", init);
            } else {
              init();
            }
          `
        }}
      />

    </div>
  );
}



