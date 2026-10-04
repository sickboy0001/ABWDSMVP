import type { SimulationRun } from "../types";

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
        <table class="data-table">
          <thead>
            <tr>
              <th>実行ID</th>
              <th>元シナリオ</th>
              <th>乱数シード (Seed)</th>
              <th>実行ステータス</th>
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
              const giniDiff = (summary.finalGini ?? 0) - (summary.initialGini ?? 0);
              const giniColor = summary.finalGini >= 0.4 ? "var(--danger)" : summary.finalGini >= 0.3 ? "var(--warning)" : "var(--success)";

              return (
                <tr key={r.id}>
                  <td style="font-family: var(--font-mono); font-size: 0.82rem;">#{r.id.slice(0, 8)}</td>
                  <td><strong>{r.scenario_title || r.scenario_id}</strong></td>
                  <td style="font-family: var(--font-mono); font-size: 0.82rem;">{r.seed_value}</td>
                  <td>
                    <span class={`badge ${r.status === "completed" ? "badge-success" : "badge-warning"}`}>
                      {r.status === "completed" ? "完了" : "中断"}
                    </span>
                  </td>
                  <td>Turn {r.final_turn} / {r.max_turns}</td>
                  <td>
                    <span style={`font-family: var(--font-mono); font-weight: 700; color: ${giniColor};`}>
                      {summary.initialGini !== undefined ? summary.initialGini.toFixed(3) : "-"}
                      {" → "}
                      {summary.finalGini !== undefined ? summary.finalGini.toFixed(3) : "-"}
                    </span>
                  </td>
                  <td>
                    {summary.finalSurvivors !== undefined
                      ? `${summary.finalSurvivors} / ${summary.initialSurvivors}人`
                      : "-"}
                  </td>
                  <td style="color: var(--text-dim); font-size: 0.8rem;">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td>
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
      )}
    </div>
  );
}
