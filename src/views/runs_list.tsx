import type { SimulationRun } from "../types";
import { formatJstDateTime } from "./scenario_list";

export function RunsListView(props: { runs: SimulationRun[] }) {
  return (
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: 700;">シミュレーション施行履歴</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Tursoデータベースに記録された過去のシミュレーション実行結果の一覧です。シード値による完全再現（Replay）が可能です。
          </p>
        </div>
        <a href="/" class="btn btn-secondary">← シナリオ一覧へ</a>
      </div>

      {props.runs.length === 0 ? (
        <div class="card" style="text-align: center; padding: 40px;">
          <p style="color: var(--text-muted); margin-bottom: 16px;">
            まだ施行履歴がありません。シナリオを選んでシミュレーションを実行・保存してください。
          </p>
          <a href="/" class="btn btn-primary">シナリオ一覧から選ぶ</a>
        </div>
      ) : (
        <div id="runs-list-container">
          {/* 比較アクションバー */}
          <div
            id="compare-action-bar"
            style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;"
          >
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem;">⚖️</span>
              <span style="font-weight: 700; color: #166534; font-size: 0.92rem;">施行比較:</span>
              <span id="compare-status-text" style="font-size: 0.86rem; color: #15803d;">
                初期条件（人口・資産・最大ターン）が一致する施行を<strong>2件</strong>選択してください。
              </span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button
                type="button"
                id="btn-clear-compare"
                class="btn btn-secondary btn-sm"
                style="display: none; padding: 4px 10px;"
              >
                選択解除
              </button>
              <button
                type="button"
                id="btn-execute-compare"
                class="btn btn-primary btn-sm"
                disabled
                style="opacity: 0.5; cursor: not-allowed; padding: 5px 16px; font-weight: 600;"
              >
                📊 選択した2件を比較する
              </button>
            </div>
          </div>

          <div style="overflow-x: auto; background: #ffffff; border-radius: 8px; border: 1px solid var(--border);">
            <table class="data-table" style="margin-top: 0; min-width: 1120px;">
              <thead>
                <tr>
                  <th style="width: 44px; text-align: center;">比較</th>
                  <th>シナリオ名</th>
                <th>初期人口</th>
                <th>初期資産</th>
                <th>最大ターン</th>
                <th>掛け金比率</th>
                <th>掛け金ルール</th>
                <th>乱数シード</th>
                <th>ステータス</th>
                <th>ターン数</th>
                <th>初期ジニ → 最終ジニ</th>
                <th>生存者数</th>
                <th>実行日時</th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
              {props.runs.map((r) => {
                const summary = r.summary || ({} as any);
                const cfg = r.scenario_config;
                const giniColor = (summary.finalGini ?? 0) >= 0.4 ? "var(--danger)" : (summary.finalGini ?? 0) >= 0.3 ? "var(--warning)" : "var(--success)";
                const betRatioStr =
                  cfg?.betRatio !== undefined
                    ? `${Math.round(cfg.betRatio * 100)}%`
                    : "-";
                const betRuleLabel =
                  cfg?.betRule === "fixed_ratio"
                    ? "fixed_ratio (敗者基準)"
                    : cfg?.betRule === "min_wealth"
                    ? "min_wealth (弱者基準)"
                    : cfg?.betRule || "-";

                  const popVal = cfg?.agentCount ?? summary.initialSurvivors ?? 0;
                  const wealthVal = cfg?.initialWealth ?? 0;
                  const maxTurnsVal = r.max_turns;

                  return (
                    <tr key={r.id}>
                      <td style="text-align: center;">
                        <input
                          type="checkbox"
                          class="run-compare-checkbox"
                          data-id={r.id}
                          data-pop={popVal}
                          data-wealth={wealthVal}
                          data-max-turns={maxTurnsVal}
                          title="比較対象として選択"
                          style="cursor: pointer; width: 16px; height: 16px;"
                        />
                      </td>
                      <td>
                      <div><strong>{r.scenario_title || r.scenario_id}</strong></div>
                      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">
                        #{r.id.slice(0, 8)}
                      </div>
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.85rem;">
                      {cfg?.agentCount !== undefined
                        ? `${cfg.agentCount.toLocaleString()}人`
                        : summary.initialSurvivors
                        ? `${summary.initialSurvivors.toLocaleString()}人`
                        : "-"}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.85rem;">
                      {cfg?.initialWealth !== undefined
                        ? `${cfg.initialWealth.toLocaleString()}円`
                        : "-"}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.85rem;">
                      {r.max_turns}
                    </td>
                    <td>
                      <span
                        class="badge"
                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 0.85rem; padding: 3px 8px;"
                      >
                        {betRatioStr}
                      </span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">
                      {betRuleLabel}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.82rem;">{r.seed_value}</td>
                    <td>
                      <span class={`badge ${r.status === "completed" ? "badge-success" : "badge-warning"}`}>
                        {r.status === "completed" ? "完了" : "中断"}
                      </span>
                    </td>
                    <td style="font-size: 0.85rem; white-space: nowrap;">Turn {r.final_turn} / {r.max_turns}</td>
                    <td>
                      <span style={`font-family: var(--font-mono); font-weight: 700; color: ${giniColor};`}>
                        {summary.initialGini !== undefined ? summary.initialGini.toFixed(3) : "-"}
                        {" → "}
                        {summary.finalGini !== undefined ? summary.finalGini.toFixed(3) : "-"}
                      </span>
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.85rem;">
                      {summary.finalSurvivors !== undefined
                        ? `${summary.finalSurvivors} / ${summary.initialSurvivors}人`
                        : "-"}
                    </td>
                    <td style="color: var(--text-dim); font-size: 0.8rem; white-space: nowrap;">
                      {formatJstDateTime(r.created_at)}
                    </td>
                    <td style="white-space: nowrap;">
                      <a href={`/runs/${r.id}`} class="btn btn-secondary btn-sm" style="margin-right: 6px;">
                        📊 レポート
                      </a>
                      <a href={`/scenarios/${r.scenario_id}/run?seed=${r.seed_value}&replay=1`} class="btn btn-secondary btn-sm">
                        🔁 リプレイ
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                function initRunCompare() {
                  const checkboxes = document.querySelectorAll('.run-compare-checkbox');
                  const statusText = document.getElementById('compare-status-text');
                  const btnCompare = document.getElementById('btn-execute-compare');
                  const btnClear = document.getElementById('btn-clear-compare');

                  if (!checkboxes.length || !btnCompare) return;

                  function updateState() {
                    const checked = Array.from(checkboxes).filter(cb => cb.checked);
                    if (checked.length === 0) {
                      if (btnClear) btnClear.style.display = 'none';
                      btnCompare.disabled = true;
                      btnCompare.style.opacity = '0.5';
                      btnCompare.style.cursor = 'not-allowed';
                      if (statusText) {
                        statusText.innerHTML = '初期条件（人口・資産・最大ターン）が一致する施行を<strong>2件</strong>選択してください。';
                        statusText.style.color = '#15803d';
                      }
                      checkboxes.forEach(cb => {
                        cb.disabled = false;
                        const row = cb.closest('tr');
                        if (row) {
                          row.style.opacity = '1';
                          row.title = '';
                        }
                      });
                      return;
                    }

                    if (btnClear) btnClear.style.display = 'inline-block';

                    const baseCb = checked[0];
                    const basePop = baseCb.getAttribute('data-pop');
                    const baseWealth = baseCb.getAttribute('data-wealth');
                    const baseMaxTurns = baseCb.getAttribute('data-max-turns');

                    checkboxes.forEach(cb => {
                      const pop = cb.getAttribute('data-pop');
                      const wealth = cb.getAttribute('data-wealth');
                      const maxTurns = cb.getAttribute('data-max-turns');
                      const isSame = (pop === basePop && wealth === baseWealth && maxTurns === baseMaxTurns);

                      if (!isSame) {
                        cb.disabled = true;
                        const row = cb.closest('tr');
                        if (row) {
                          row.style.opacity = '0.45';
                          row.title = '初期条件（人口 ' + pop + '人/資産 ¥' + Number(wealth).toLocaleString() + '/' + maxTurns + 'T）が選択中の条件（' + basePop + '人/¥' + Number(baseWealth).toLocaleString() + '/' + baseMaxTurns + 'T）と異なるため比較できません';
                        }
                      } else {
                        cb.disabled = (checked.length >= 2 && !cb.checked);
                        const row = cb.closest('tr');
                        if (row) {
                          row.style.opacity = '1';
                          row.title = '';
                        }
                      }
                    });

                    if (checked.length === 1) {
                      btnCompare.disabled = true;
                      btnCompare.style.opacity = '0.5';
                      btnCompare.style.cursor = 'not-allowed';
                      if (statusText) {
                        statusText.innerHTML = '1件選択中（人口 <strong>' + basePop + '人</strong> / 資産 <strong>¥' + Number(baseWealth).toLocaleString() + '</strong> / <strong>' + baseMaxTurns + 'T</strong>）。同じ条件の比較対象をあと<strong>1件</strong>選択してください。';
                        statusText.style.color = '#0284c7';
                      }
                    } else if (checked.length === 2) {
                      btnCompare.disabled = false;
                      btnCompare.style.opacity = '1';
                      btnCompare.style.cursor = 'pointer';
                      if (statusText) {
                        statusText.innerHTML = '2件選択完了！（条件: 人口 <strong>' + basePop + '人</strong> / 資産 <strong>¥' + Number(baseWealth).toLocaleString() + '</strong> / <strong>' + baseMaxTurns + 'T</strong>）。「選択した2件を比較する」をクリックして動態を比較できます。';
                        statusText.style.color = '#15803d';
                      }
                    }
                  }

                  checkboxes.forEach(cb => {
                    cb.addEventListener('change', updateState);
                  });

                  btnClear?.addEventListener('click', () => {
                    checkboxes.forEach(cb => { cb.checked = false; });
                    updateState();
                  });

                  btnCompare?.addEventListener('click', () => {
                    const checked = Array.from(checkboxes).filter(cb => cb.checked);
                    if (checked.length === 2) {
                      const id1 = checked[0].getAttribute('data-id');
                      const id2 = checked[1].getAttribute('data-id');
                      window.location.href = '/runs/compare?run1=' + encodeURIComponent(id1) + '&run2=' + encodeURIComponent(id2);
                    }
                  });
                }
                initRunCompare();
              `
            }}
          />
        </div>

      )}
    </div>
  );
}
