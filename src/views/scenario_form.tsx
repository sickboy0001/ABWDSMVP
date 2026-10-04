import type { Scenario, ScenarioConfig } from "../types";

export function ScenarioFormView(props: {
  scenario?: Scenario;
  isEdit?: boolean;
}) {
  let cfg: Partial<ScenarioConfig> = {
    agentCount: 500,
    maxTurns: 200,
    initialWealth: 10000,
    wealthDistribution: "equal",
    waitRate: 0,
    investorRate: 0,
    investorReturnRate: 5,
    investorFailRate: 4,
    learningAgent: false,
    matchRule: "random",
    communityGroups: 4,
    strongAdvantage: false,
    strongAdvantageTopPercent: 10,
    strongAdvantageBonus: 0.15,
    betRule: "min_wealth",
    betRatio: 0.1,
    ubiEnabled: false,
    ubiAmount: 0,
    progressiveTaxEnabled: false,
    progressiveTaxThreshold: 20000,
    progressiveTaxRate: 0,
    reliefEnabled: false,
    reliefRate: 0.05,
    inflationRate: 0.0,
    bankruptcyThreshold: 0
  };

  if (props.scenario) {
    try {
      cfg = { ...cfg, ...JSON.parse(props.scenario.config_json) };
    } catch (e) {}
  }

  const actionUrl = props.isEdit && props.scenario
    ? `/api/scenarios/${props.scenario.id}/update`
    : "/api/scenarios";

  return (
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 1.5rem; font-weight: 700;">
          {props.isEdit ? "シナリオ編集" : "新規シナリオ作成"}
        </h1>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          シミュレーションの環境条件（人口・初期資産）を設定します。
        </p>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 20px;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">プリセット自動入力:</span>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-standard">🤝 標準モデル (500人 / ¥10,000)</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-large">👥 大規模モデル (1,000人 / ¥10,000)</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-quick">⚡ クイック検証モデル (100人 / ¥10,000)</button>
      </div>

      <form method="post" action={actionUrl} id="scenario-form">
        <div class="sim-panel" style="margin-bottom: 20px;">
          <h2>1. 基本情報</h2>
          <div class="form-group">
            <label class="form-label">シナリオ名 *</label>
            <input type="text" name="title" class="form-control" defaultValue={props.scenario?.title || ""} placeholder="例: 純粋ヤードセールモデル（格差の凝縮検証）" required />
          </div>
          <div class="form-group">
            <label class="form-label">シナリオ説明</label>
            <textarea name="description" class="form-control" rows={3} placeholder="このシミュレーションで検証したい目的や前提条件">{props.scenario?.description || ""}</textarea>
          </div>
        </div>

        <div class="sim-panel" style="margin-bottom: 20px;">
          <h2>2. 環境設定（人口 & 初期資産）</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">エージェント数 (人口)</label>
              <input type="number" name="agentCount" class="form-control" defaultValue={cfg.agentCount || 500} min="50" max="5000" step="50" required />
            </div>
            <div class="form-group">
              <label class="form-label">初期資産 (円)</label>
              <input type="number" name="initialWealth" class="form-control" defaultValue={cfg.initialWealth || 10000} step="1000" min="1000" required />
            </div>
            <div class="form-group">
              <label class="form-label">最大ターン数</label>
              <input type="number" name="maxTurns" class="form-control" defaultValue={cfg.maxTurns || 200} min="10" max="1000" step="10" required />
            </div>
          </div>
        </div>
        {/* 将来機能拡張の予告案内カード */}
        <div class="sim-panel" style="margin-bottom: 20px; background: #f8fafc; border: 1px dashed var(--border);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 1.1rem;">🚀</span>
            <h3 style="font-size: 0.95rem; font-weight: 700; margin: 0; color: var(--text-main);">将来拡張予定モジュール</h3>
          </div>
          <p style="font-size: 0.83rem; color: var(--text-muted); margin: 0 0 12px; line-height: 1.5;">
            純粋ヤードセールモデルに対し、環境条件の「初期資産分布」や「個性」、およびマクロ経済循環8要素（①労働〜⑧再分配）は今後の機能拡張で段階的に追加設定できるようになります。
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <span class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 600; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">📊 初期資産分布 (Distribution)</span>
            <span class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 600; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">👤 個性 (Personality)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">① 労働 (Labor)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">② 賃金 (Wage)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">③ 生産 (Production)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">④ 物価 (Price)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">⑤ 消費 (Consumption)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">⑥ 金融 (Finance)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">⑦ 政府 (Government)</span>
            <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">⑧ 再分配 (Redistribution)</span>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <a href="/" class="btn btn-secondary">キャンセル</a>
          <button type="submit" class="btn btn-primary" style="padding: 10px 28px;">
            {props.isEdit ? "設定を更新する" : "シナリオを保存する"}
          </button>
        </div>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('btn-preset-standard')?.addEventListener('click', () => {
              const form = document.getElementById('scenario-form');
              form.querySelector('input[name="title"]').value = '純粋ヤードセールモデル（標準500人）';
              form.querySelector('textarea[name="description"]').value = '公平な初期条件から50%コイントス取引を繰り返し、数学的に富が1人へ凝縮していくヤードセール現象を検証する基本シナリオ。';
              form.querySelector('input[name="agentCount"]').value = 500;
              form.querySelector('input[name="initialWealth"]').value = 10000;
              form.querySelector('input[name="maxTurns"]').value = 200;
            });

            document.getElementById('btn-preset-large')?.addEventListener('click', () => {
              const form = document.getElementById('scenario-form');
              form.querySelector('input[name="title"]').value = '大規模ヤードセールモデル（1,000人規模）';
              form.querySelector('textarea[name="description"]').value = '1,000人のエージェントによる大規模取引市場で、オリガルヒ化（少数の超富裕層への富の集中）の進展速度を観察するシナリオ。';
              form.querySelector('input[name="agentCount"]').value = 1000;
              form.querySelector('input[name="initialWealth"]').value = 10000;
              form.querySelector('input[name="maxTurns"]').value = 300;
            });

            document.getElementById('btn-preset-quick')?.addEventListener('click', () => {
              const form = document.getElementById('scenario-form');
              form.querySelector('input[name="title"]').value = 'クイック検証ヤードセールモデル（100人）';
              form.querySelector('textarea[name="description"]').value = '100人のエージェントによる小規模市場で、短時間・低負荷にヤードセール動態の推移を確認できるシナリオ。';
              form.querySelector('input[name="agentCount"]').value = 100;
              form.querySelector('input[name="initialWealth"]').value = 10000;
              form.querySelector('input[name="maxTurns"]').value = 150;
            });
          `
        }}
      />
    </div>
  );
}

