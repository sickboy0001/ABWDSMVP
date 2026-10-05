import type { Scenario, SimulationRun, ScenarioConfig } from "../types";

export function parseDbUtcDate(dateInput: string | Date | number): Date {
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === "number") return new Date(dateInput);
  let s = String(dateInput || "").trim();
  if (!s) return new Date();
  if (!s.includes("T") && s.includes(" ")) {
    s = s.replace(" ", "T");
  }
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("-", 10)) {
    s += "Z";
  }
  return new Date(s);
}

export function formatJstDateTime(dateInput: string | Date | number): string {
  const d = parseDbUtcDate(dateInput);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function formatFuzzyTime(dateInput: string | Date | number): string {
  const d = parseDbUtcDate(dateInput);
  const now = Date.now();
  const diffMs = now - d.getTime();

  if (isNaN(diffMs)) return "-";
  if (diffMs < 0) return "たった今";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "たった今";
  if (diffSec < 90) return "1分前";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}時間前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}週間前`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}ヶ月前`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}年前`;
}

export function ScenarioListView(props: {
  scenarios: Scenario[];
  recentRuns: SimulationRun[];
}) {
  const recentCount = props.scenarios.filter((s) => s.last_run_at).length;
  const totalCount = props.scenarios.length;
  // 最近施行されたものがある場合は最近施行のみをデフォルト表示、なければすべて表示
  const defaultFilter = recentCount > 0 ? "recent" : "all";

  return (
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: 700;">シナリオ一覧</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px;">
            検証したい前提条件・社会制度ルールを選択して施行（シミュレーション）を開始します。
          </p>
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 8px;">
            <button
              type="button"
              id="filter-btn-recent"
              class={`btn btn-sm ${defaultFilter === "recent" ? "btn-primary" : "btn-secondary"}`}
              style="border-radius: 6px; padding: 6px 14px; font-size: 0.85rem;"
            >
              🕒 最近施行したもの ({recentCount})
            </button>
            <button
              type="button"
              id="filter-btn-all"
              class={`btn btn-sm ${defaultFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              style="border-radius: 6px; padding: 6px 14px; font-size: 0.85rem;"
            >
              📁 すべて ({totalCount})
            </button>
          </div>
        </div>
        <a href="/scenarios/new" class="btn btn-primary">＋ 新規シナリオ作成</a>
      </div>

      <div
        id="empty-recent-msg"
        style={{
          display: recentCount === 0 && defaultFilter === "recent" ? "block" : "none",
          padding: "36px 20px",
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1px dashed var(--border)",
          borderRadius: "10px",
          margin: "20px 0"
        }}
      >
        <p style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.95rem;">
          まだ施行（シミュレーション実行）されたシナリオがありません。
        </p>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-show-all-from-empty">
          📁 すべてのシナリオを表示する ({totalCount})
        </button>
      </div>

      <div class="grid-cards">
        {props.scenarios.map((scen) => {
          let cfg: ScenarioConfig = {} as ScenarioConfig;
          try {
            cfg = JSON.parse(scen.config_json);
          } catch (e) {}

          const hasRun = Boolean(scen.last_run_at);
          const isHiddenByDefault = defaultFilter === "recent" && !hasRun;

          return (
            <div
              class="card scenario-card-item"
              key={scen.id}
              data-has-run={hasRun ? "1" : "0"}
              style={isHiddenByDefault ? "display: none;" : ""}
            >
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                <h3 class="card-title" style="margin-bottom: 0;">{scen.title}</h3>
                {scen.last_run_at && (
                  <span
                    class="badge fuzzy-badge"
                    data-timestamp={scen.last_run_at}
                    title={`最終施行: ${formatJstDateTime(scen.last_run_at)} (JST)`}
                    style="background: #e0f2fe; color: #0369a1; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-weight: 600; cursor: help;"
                  >
                    🕒 {formatFuzzyTime(scen.last_run_at)}
                  </span>
                )}
              </div>
              <p class="card-desc">{scen.description || "説明なし"}</p>
              <div class="card-meta">
                <span>人数: {cfg.agentCount || 500}人</span>
                <span>ターン: {cfg.maxTurns || 200}</span>
                <span>初期: ¥{(cfg.initialWealth || 10000).toLocaleString()}</span>
                <span>掛け金: {Math.round((cfg.betRatio ?? 0.1) * 100)}% ({cfg.betRule || "min_wealth"})</span>
                {scen.last_run_at && (
                  <span
                    class="fuzzy-meta"
                    data-timestamp={scen.last_run_at}
                    title={`最終施行: ${formatJstDateTime(scen.last_run_at)} (JST)`}
                    style="color: var(--primary); font-weight: 600; cursor: help;"
                  >
                    最終施行: {formatFuzzyTime(scen.last_run_at)}
                  </span>
                )}
              </div>
              <div style="display: flex; gap: 8px; justify-content: space-between;">
                <a href={`/scenarios/${scen.id}/run`} class="btn btn-primary" style="flex: 1;">
                  ▶ 施行する
                </a>
                <a href={`/scenarios/new?from=${scen.id}`} class="btn btn-secondary btn-sm" title="設定を引き継いで新規作成">
                  📄 コピー
                </a>
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
                    {formatJstDateTime(run.created_at)}
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

      <script
        dangerouslySetInnerHTML={{
          __html: `
            const btnRecent = document.getElementById('filter-btn-recent');
            const btnAll = document.getElementById('filter-btn-all');
            const btnEmptyShowAll = document.getElementById('btn-show-all-from-empty');
            const cards = document.querySelectorAll('.scenario-card-item');
            const emptyMsg = document.getElementById('empty-recent-msg');
            const recentCount = ${recentCount};

            function setFilter(mode) {
              if (mode === 'recent') {
                btnRecent?.classList.remove('btn-secondary');
                btnRecent?.classList.add('btn-primary');
                btnAll?.classList.remove('btn-primary');
                btnAll?.classList.add('btn-secondary');

                let visibleCount = 0;
                cards.forEach(card => {
                  const hasRun = card.getAttribute('data-has-run') === '1';
                  if (hasRun) {
                    card.style.display = '';
                    visibleCount++;
                  } else {
                    card.style.display = 'none';
                  }
                });

                if (emptyMsg) {
                  emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
                }
              } else {
                btnAll?.classList.remove('btn-secondary');
                btnAll?.classList.add('btn-primary');
                btnRecent?.classList.remove('btn-primary');
                btnRecent?.classList.add('btn-secondary');

                cards.forEach(card => {
                  card.style.display = '';
                });

                if (emptyMsg) {
                  emptyMsg.style.display = 'none';
                }
              }
            }

            btnRecent?.addEventListener('click', () => setFilter('recent'));
            btnAll?.addEventListener('click', () => setFilter('all'));
            btnEmptyShowAll?.addEventListener('click', () => setFilter('all'));

            const params = new URLSearchParams(window.location.search);
            const queryFilter = params.get('filter');
            if (queryFilter === 'all') {
              setFilter('all');
            } else if (queryFilter === 'recent') {
              setFilter('recent');
            }

            function parseUtc(dateStr) {
              if (!dateStr) return new Date();
              let s = String(dateStr).trim();
              if (!s.includes('T') && s.includes(' ')) s = s.replace(' ', 'T');
              if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
              return new Date(s);
            }

            function clientFuzzy(dateStr) {
              const d = parseUtc(dateStr);
              const diffMs = Date.now() - d.getTime();
              if (isNaN(diffMs)) return '-';
              if (diffMs < 0) return 'たった今';
              const diffSec = Math.floor(diffMs / 1000);
              if (diffSec < 45) return 'たった今';
              if (diffSec < 90) return '1分前';
              const diffMin = Math.floor(diffSec / 60);
              if (diffMin < 60) return diffMin + '分前';
              const diffHours = Math.floor(diffMin / 60);
              if (diffHours < 24) return diffHours + '時間前';
              const diffDays = Math.floor(diffHours / 24);
              if (diffDays === 1) return '昨日';
              if (diffDays < 7) return diffDays + '日前';
              const diffWeeks = Math.floor(diffDays / 7);
              if (diffWeeks < 4) return diffWeeks + '週間前';
              const diffMonths = Math.floor(diffDays / 30);
              if (diffMonths < 12) return diffMonths + 'ヶ月前';
              const diffYears = Math.floor(diffDays / 365);
              return diffYears + '年前';
            }

            function refreshFuzzyTimes() {
              document.querySelectorAll('.fuzzy-badge').forEach(el => {
                const ts = el.getAttribute('data-timestamp');
                if (ts) {
                  const d = parseUtc(ts);
                  el.textContent = '🕒 ' + clientFuzzy(ts);
                  el.setAttribute('title', '最終施行: ' + d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' (JST)');
                }
              });
              document.querySelectorAll('.fuzzy-meta').forEach(el => {
                const ts = el.getAttribute('data-timestamp');
                if (ts) {
                  const d = parseUtc(ts);
                  el.textContent = '最終施行: ' + clientFuzzy(ts);
                  el.setAttribute('title', '最終施行: ' + d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' (JST)');
                }
              });
            }
            refreshFuzzyTimes();
          `
        }}
      />
    </div>
  );
}
