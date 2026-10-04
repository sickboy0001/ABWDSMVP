import type { Scenario, SimulationRun, ScenarioConfig } from "../types";

export function ScenarioListView(props: {
  scenarios: Scenario[];
  recentRuns: SimulationRun[];
}) {
  return (
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: 700;">シナリオ一覧</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            検証したい前提条件・社会制度ルールを選択して施行（シミュレーション）を開始します。
          </p>
        </div>
        <a href="/scenarios/new" class="btn btn-primary">＋ 新規シナリオ作成</a>
      </div>

      <div class="grid-cards">
        {props.scenarios.map((scen) => {
          let cfg: ScenarioConfig = {} as ScenarioConfig;
          try {
            cfg = JSON.parse(scen.config_json);
          } catch (e) {}

          return (
            <div class="card" key={scen.id}>
              <h3 class="card-title">{scen.title}</h3>
              <p class="card-desc">{scen.description || "説明なし"}</p>
              <div class="card-meta">
                <span>人数: {cfg.agentCount || 500}人</span>
                <span>ターン: {cfg.maxTurns || 200}</span>
                <span>初期: ¥{(cfg.initialWealth || 10000).toLocaleString()}</span>
              </div>
              <div style="display: flex; gap: 8px; justify-content: space-between;">
                <a href={`/scenarios/${scen.id}/run`} class="btn btn-primary" style="flex: 1;">
                  ▶ 施行する
                </a>
                <form method="post" action={`/api/scenarios/${scen.id}/copy`} style="margin: 0;">
                  <button type="submit" class="btn btn-secondary btn-sm" title="コピーして作成">
                    📄 コピー
                  </button>
                </form>
                <a href={`/scenarios/${scen.id}/edit`} class="btn btn-secondary btn-sm" title="設定編集">
                  ✏️ 編集
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {props.recentRuns.length > 0 && (
        <div style="margin-top: 50px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 style="font-size: 1.2rem; font-weight: 700;">直近のシミュレーション施行履歴</h2>
            <a href="/runs" style="font-size: 0.85rem;">すべて見る →</a>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>実行ID</th>
                <th>シナリオ名</th>
                <th>シード値</th>
                <th>進行状況</th>
                <th>最終ジニ係数</th>
                <th>生存率</th>
                <th>実行日</th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
              {props.recentRuns.map((run) => (
                <tr key={run.id}>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">#{run.id.slice(0, 8)}</td>
                  <td>{run.scenario_title || run.scenario_id}</td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">{run.seed_value}</td>
                  <td>Turn {run.final_turn} / {run.max_turns}</td>
                  <td>
                    <span style="font-family: var(--font-mono); font-weight: 700;">
                      {run.summary?.finalGini !== undefined ? run.summary.finalGini.toFixed(3) : "-"}
                    </span>
                  </td>
                  <td>
                    {run.summary?.finalSurvivors !== undefined && run.summary?.initialSurvivors
                      ? `${((run.summary.finalSurvivors / run.summary.initialSurvivors) * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                  <td style="color: var(--text-dim); font-size: 0.8rem;">
                    {new Date(run.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td>
                    <a href={`/runs/${run.id}`} class="btn btn-secondary btn-sm" style="margin-right: 6px;">
                      詳細
                    </a>
                    <a href={`/scenarios/${run.scenario_id}/run?seed=${run.seed_value}&replay=1`} class="btn btn-secondary btn-sm">
                      🔁 リプレイ
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
