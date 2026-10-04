import type { SimulationRun, TurnLog, EventLog } from "../types";

export function RunReportView(props: {
  run: SimulationRun;
  turnLogs: TurnLog[];
  eventLogs: EventLog[];
}) {
  const summary = props.run.summary || ({} as any);
  const diff = (summary.finalGini ?? 0) - (summary.initialGini ?? 0);
  const isWorsened = diff > 0.05;

  return (
    <div>
      <div class="simulator-header">
        <div class="sim-title-group">
          <h1>シミュレーション結果詳細レポート</h1>
          <div class="meta">
            <span>RUN ID: <strong style="font-family: var(--font-mono);">#{props.run.id.slice(0, 8)}</strong></span>
            <span>シナリオ: <strong>{props.run.scenario_title || props.run.scenario_id}</strong></span>
            <span>SEED: <strong style="font-family: var(--font-mono);">{props.run.seed_value}</strong></span>
            <span>最終ターン: <strong>Turn {props.run.final_turn} / {props.run.max_turns}</strong></span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href={`/api/runs/${props.run.id}/export.csv`} class="btn btn-secondary" download>
            📊 CSVエクスポート
          </a>
          <a href={`/scenarios/${props.run.scenario_id}/run?seed=${props.run.seed_value}&replay=1`} class="btn btn-primary">
            🔁 完全再現リプレイ
          </a>
        </div>
      </div>

      {/* エグゼクティブ・サマリー */}
      <div class="summary-box">
        <h3>■ エグゼクティブ・サマリー (主要分析結果)</h3>
        <p>
          ・初期ジニ係数 <strong>{(summary.initialGini ?? 0).toFixed(3)}</strong> から、最終ターン（Turn {props.run.final_turn}）時点で{" "}
          <strong style={`color: ${isWorsened ? "var(--danger)" : "var(--success)"}; font-size: 1.1rem;`}>
            {(summary.finalGini ?? 0).toFixed(3)}
          </strong>{" "}
          へ変化しました（格差変化率: {summary.giniChangeRate >= 0 ? `+${summary.giniChangeRate}%` : `${summary.giniChangeRate}%`}）。
        </p>
        <p>
          ・生存者数: <strong>{summary.finalSurvivors ?? 0} 人</strong> / 初期 {summary.initialSurvivors ?? 0} 人
          （脱落者: {summary.dropoutCount ?? 0} 人、脱落率: {summary.dropoutRate ?? 0}%）。
        </p>
        <p>
          ・富の集中度: 上位1%が全資産の <strong>{(summary.top1Share ?? 0).toFixed(1)}%</strong>、上位10%が{" "}
          <strong>{(summary.top10Share ?? 0).toFixed(1)}%</strong> を占有し、下位50%のシェアは{" "}
          <strong>{(summary.bottom50Share ?? 0).toFixed(1)}%</strong> となりました。
        </p>
      </div>

      {/* 主要KPIカード一覧 */}
      <div class="kpi-row" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 30px;">
        <div class="kpi-card">
          <div class="kpi-label">最終ジニ係数</div>
          <div class="kpi-value">{(summary.finalGini ?? 0).toFixed(3)}</div>
          <div class="kpi-sub">初期: {(summary.initialGini ?? 0).toFixed(3)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">生存率</div>
          <div class="kpi-value">
            {summary.initialSurvivors ? `${(((summary.finalSurvivors ?? 0) / summary.initialSurvivors) * 100).toFixed(1)}%` : "-"}
          </div>
          <div class="kpi-sub">{summary.finalSurvivors} / {summary.initialSurvivors} 人</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">平均資産</div>
          <div class="kpi-value">¥{(summary.finalMeanWealth ?? 0).toLocaleString()}</div>
          <div class="kpi-sub">中央値: ¥{(summary.finalMedianWealth ?? 0).toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">上位10%資産シェア</div>
          <div class="kpi-value">{(summary.top10Share ?? 0).toFixed(1)}%</div>
          <div class="kpi-sub">下位50%: {(summary.bottom50Share ?? 0).toFixed(1)}%</div>
        </div>
      </div>
      {/* イベントログ */}
      {props.eventLogs.length > 0 && (
        <div class="sim-panel" style="margin-bottom: 30px;">
          <h2>発生イベント履歴</h2>
          <div class="log-box" style="height: auto; max-height: 200px;">
            {props.eventLogs.map((e, idx) => (
              <div class="log-item" key={idx}>
                <span style="color: var(--primary);">[Turn {e.turn}]</span>{" "}
                <span class="badge badge-info" style="margin-right: 6px;">{e.event_type}</span>{" "}
                {e.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ターン推移集計テーブル */}
      <div class="sim-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h2>ターン別マクロ指標ログ（10ターン毎および最終ターン）</h2>
          <span style="font-size: 0.82rem; color: var(--text-dim);">全 {props.turnLogs.length} レコード</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>ターン</th>
              <th>ジニ係数</th>
              <th>生存者数</th>
              <th>平均資産</th>
              <th>中央値</th>
              <th>Top 1%</th>
              <th>Top 10%</th>
              <th>Bottom 50%</th>
            </tr>
          </thead>
          <tbody>
            {props.turnLogs.map((log) => (
              <tr key={log.turn}>
                <td><strong>Turn {log.turn}</strong></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">{log.gini_index.toFixed(3)}</td>
                <td>{log.survivor_count} 人</td>
                <td>¥{log.mean_wealth.toLocaleString()}</td>
                <td>¥{log.median_wealth.toLocaleString()}</td>
                <td style="font-family: var(--font-mono);">{log.top_1_share.toFixed(1)}%</td>
                <td style="font-family: var(--font-mono);">{log.top_10_share.toFixed(1)}%</td>
                <td style="font-family: var(--font-mono);">{log.bottom_50_share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

