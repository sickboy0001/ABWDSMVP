import type { Scenario, ScenarioConfig } from "../types";

export function ScenarioFormView(props: {
  scenario?: Scenario;
  isEdit?: boolean;
}) {
  let cfg: Partial<ScenarioConfig> = {
    agentCount: 200,
    maxTurns: 500,
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

  const disabledInputStyle = props.isEdit
    ? "background: #f1f5f9; color: var(--text-muted); cursor: not-allowed;"
    : "";

  return (
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 1.5rem; font-weight: 700;">
          {props.isEdit ? "シナリオ基本情報編集" : props.scenario ? "シナリオ複製作成" : "新規シナリオ作成"}
        </h1>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          {props.isEdit
            ? "シナリオ名および説明文を編集します（環境設定やゼロサム取引設定は固定されています）。"
            : props.scenario
            ? "コピー元の設定を引き継いで新しいシナリオを作成します。環境設定やゼロサム取引パラメータを自由に変更できます。"
            : "シミュレーションの環境条件（人口・初期資産・取引ルール）を設定します。"}
        </p>
      </div>

      {props.isEdit && (
        <div style="background: #f8fafc; border: 1px solid var(--border); border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.88rem; color: var(--text-main); line-height: 1.5;">
          ℹ️ <strong>設定変更の制限について:</strong> 過去のシミュレーション施行結果との整合性・再現性を担保するため、シナリオ作成後の環境設定（人口・初期資産・ターン数）やゼロサム取引ルールは変更できません。<br />
          異なるパラメータで検証したい場合は、一覧画面から「<strong>📄 コピー</strong>」を行って新しいシナリオを作成してください。
        </div>
      )}

      {props.scenario && !props.isEdit && (
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.88rem; color: var(--text-main); line-height: 1.5;">
          📋 <strong>シナリオの複製作成:</strong> コピー元の環境設定やゼロサム取引パラメータを引き継ぎました。必要に応じて各設定値を自由に変更して保存してください。
        </div>
      )}

      <form method="post" action={actionUrl} id="scenario-form">
        <div class="sim-panel" style="margin-bottom: 20px;">
          <h2>1. 基本情報（編集可能）</h2>
          <div class="form-group">
            <label class="form-label">シナリオ名 *</label>
            <input type="text" name="title" class="form-control" value={props.scenario?.title || ""} placeholder="例: 純粋ヤードセールモデル（格差の凝縮検証）" required />
          </div>
          <div class="form-group">
            <label class="form-label">シナリオ説明</label>
            <textarea name="description" class="form-control" rows={3} placeholder="このシミュレーションで検証したい目的や前提条件">{props.scenario?.description || ""}</textarea>
          </div>
        </div>

        <div class="sim-panel" style="margin-bottom: 20px;">
          <h2>2. 環境設定（人口 & 初期資産）{props.isEdit && <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted); margin-left: 8px;">(変更不可)</span>}</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">エージェント数 (人口)</label>
              <input
                type="number"
                name="agentCount"
                class="form-control"
                value={cfg.agentCount || 200}
                min="10"
                max="5000"
                step="10"
                disabled={props.isEdit}
                style={disabledInputStyle}
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">初期資産 (円)</label>
              <input
                type="number"
                name="initialWealth"
                class="form-control"
                value={cfg.initialWealth || 10000}
                step="1000"
                min="1000"
                disabled={props.isEdit}
                style={disabledInputStyle}
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">最大ターン数</label>
              <input
                type="number"
                name="maxTurns"
                class="form-control"
                value={cfg.maxTurns || 500}
                min="10"
                max="1000"
                step="10"
                disabled={props.isEdit}
                style={disabledInputStyle}
                required
              />
            </div>
          </div>
        </div>

        <div class="sim-panel" style="margin-bottom: 20px;">
          <h2>3. ゼロサム取引・掛け金設定 (Yard-Sale Rule){props.isEdit && <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted); margin-left: 8px;">(変更不可)</span>}</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -6px; margin-bottom: 16px;">
            エージェント同士の1対1対戦で移動する金額（賭け金）の計算基準と割合です。
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">
                掛け金比率 (betRatio): <strong id="bet-ratio-display">{Math.round((cfg.betRatio ?? 0.1) * 100)}%</strong>
                <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted); margin-left: 6px;">
                  (小数: {cfg.betRatio ?? 0.1})
                </span>
              </label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input
                  type="number"
                  name="betRatio"
                  id="input-bet-ratio"
                  class="form-control"
                  value={Math.round((cfg.betRatio ?? 0.1) * 100)}
                  min="1"
                  max="100"
                  step="1"
                  disabled={props.isEdit}
                  style={`width: 110px; ${disabledInputStyle}`}
                  required
                />
                <span style="font-weight: 700; color: var(--text-main);">％</span>
              </div>
              {!props.isEdit && (
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm btn-quick-ratio" data-ratio="10">0.1 (10% 標準)</button>
                  <button type="button" class="btn btn-secondary btn-sm btn-quick-ratio" data-ratio="20">0.2 (20% 加速)</button>
                  <button type="button" class="btn btn-secondary btn-sm btn-quick-ratio" data-ratio="50">0.5 (50% 高速)</button>
                  <button type="button" class="btn btn-secondary btn-sm btn-quick-ratio" data-ratio="100">1.0 (100% 全額勝負)</button>
                </div>
              )}
              <small style="display: block; color: var(--text-muted); margin-top: 8px; font-size: 0.8rem; line-height: 1.4;">
                💡 <strong>0.1（10%）</strong>: 緩やかに富が集約。<br />
                💡 <strong>0.2（20%）</strong>: 短期間で格差が急激に拡大。<br />
                💡 <strong>1.0（100%）</strong>: 敗者が1戦で全財産を失い即破産・脱落するトーナメント型。
              </small>
            </div>

            <div class="form-group">
              <label class="form-label">掛け金ルール (betRule)</label>
              <select name="betRule" class="form-control" disabled={props.isEdit} style={disabledInputStyle}>
                <option value="min_wealth" selected={(cfg.betRule || "min_wealth") === "min_wealth"}>min_wealth: 少ない方の資産基準 (ヤードセール標準・弱者基準)</option>
                <option value="fixed_ratio" selected={cfg.betRule === "fixed_ratio"}>fixed_ratio: 敗者の資産基準 (勝敗により移動金額が非対称)</option>
              </select>
              <small style="display: block; color: var(--text-muted); margin-top: 8px; font-size: 0.8rem; line-height: 1.4;">
                ※ <strong>min_wealth</strong> を選択すると、双方の資産のうち小さい方のX%（例: 1,000円 vs 10,000円なら1,000円の10%=100円）が掛け金となり、弱者の過剰な即死を防ぎます。
              </small>
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
            const inputBetRatio = document.getElementById('input-bet-ratio');
            const betRatioDisplay = document.getElementById('bet-ratio-display');
            
            function updateBetRatioDisplay(val) {
              const num = Number(val) || 10;
              if (betRatioDisplay) {
                betRatioDisplay.textContent = num + '%';
              }
            }

            if (inputBetRatio && !inputBetRatio.disabled) {
              inputBetRatio.addEventListener('input', (e) => {
                updateBetRatioDisplay(e.target.value);
              });
            }

            document.querySelectorAll('.btn-quick-ratio').forEach((btn) => {
              btn.addEventListener('click', (e) => {
                const ratio = e.target.getAttribute('data-ratio');
                if (inputBetRatio && !inputBetRatio.disabled && ratio) {
                  inputBetRatio.value = ratio;
                  updateBetRatioDisplay(ratio);
                }
              });
            });
          `
        }}
      />
    </div>
  );
}

