/**
 * ABWDS - Simulator UI Controller & Canvas Visualizer
 */

class SimulatorUI {
  constructor(options) {
    this.scenarioId = options.scenarioId;
    this.config = options.config;
    this.seed = options.seed || Math.floor(Math.random() * 10000000);
    this.runId = options.runId || null;
    this.isReplay = Boolean(options.isReplay);

    this.engine = new SimulationEngine(this.config, this.seed);
    this.timer = null;
    this.isPlaying = false;
    this.speedMs = 60; // 1ターンあたりのウェイト
    this.activeTab = "individuals"; // 'individuals' | 'histogram' | 'yardsale' | 'trajectories' | 'lorenz' | 'trend'

    // 個人別資産動態用パラメータ
    this.individualSortMode = "sorted"; // 'sorted' (パレード) | 'id' (ID固定・上下動)
    this.individualSampleSize = 100; // 100 | 'all'
    this.trackedAgentId = null;
    this.hoveredAgent = null;
    this.hoverCoords = null;
    this.renderedAgentSlots = [];

    this.initDOMElements();
    this.bindEvents();
    this.updateUI();
  }

  initDOMElements() {
    this.elCurrentTurn = document.getElementById("kpi-turn");
    this.elMaxTurn = document.getElementById("kpi-max-turn");
    this.elGini = document.getElementById("kpi-gini");
    this.elGiniDiff = document.getElementById("kpi-gini-diff");
    this.elSurvivors = document.getElementById("kpi-survivors");
    this.elDropoutRate = document.getElementById("kpi-dropout-rate");
    this.elMeanWealth = document.getElementById("kpi-mean-wealth");
    this.elMedianWealth = document.getElementById("kpi-median-wealth");
    this.elTop1 = document.getElementById("kpi-top1");
    this.elTop10 = document.getElementById("kpi-top10");
    this.elBottom50 = document.getElementById("kpi-bottom50");
    this.elHeaderGini = document.getElementById("kpi-header-gini");
    this.elHeaderSurvivors = document.getElementById("kpi-header-survivors");
    this.elHeaderMean = document.getElementById("kpi-header-mean");
    this.elStatus = document.getElementById("sim-status");
    this.elSeed = document.getElementById("sim-seed");
    this.elLogBox = document.getElementById("sim-event-logs");
    this.canvas = document.getElementById("sim-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    if (this.elSeed) this.elSeed.value = this.seed;
    if (this.elMaxTurn) this.elMaxTurn.innerText = this.config.maxTurns || 200;
  }

  bindEvents() {
    // 再生・一時停止・コマ送りボタン
    document.getElementById("btn-play")?.addEventListener("click", () => this.togglePlay());
    document.getElementById("btn-step-next")?.addEventListener("click", () => this.step(1));
    document.getElementById("btn-step-next10")?.addEventListener("click", () => this.step(10));
    document.getElementById("btn-step-prev")?.addEventListener("click", () => this.stepBack(1));
    document.getElementById("btn-step-prev10")?.addEventListener("click", () => this.stepBack(10));
    document.getElementById("btn-jump-start")?.addEventListener("click", () => this.jumpStart());
    document.getElementById("btn-jump-end")?.addEventListener("click", () => this.jumpEnd());
    document.getElementById("btn-reset")?.addEventListener("click", () => this.reset());
    document.getElementById("btn-new-seed")?.addEventListener("click", () => this.newSeed());

    // 速度スライダー
    const speedSlider = document.getElementById("speed-slider");
    speedSlider?.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      this.speedMs = Math.max(1, 150 - val * 1.4); // 1〜150ms
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    });

    // タブ切り替え
    document.querySelectorAll(".viz-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".viz-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeTab = btn.dataset.tab;
        
        // 個人動態サブバーの表示切替
        const subBar = document.getElementById("sub-bar-individuals");
        if (subBar) {
          subBar.style.display = this.activeTab === "individuals" ? "flex" : "none";
        }
        
        this.renderCanvas();
      });
    });

    // 個人動態サブコントロール
    const btnSortWealth = document.getElementById("btn-indiv-sort-wealth");
    const btnSortId = document.getElementById("btn-indiv-sort-id");
    const selectSample = document.getElementById("select-indiv-sample");
    const btnClearTrack = document.getElementById("btn-indiv-clear-track");

    btnSortWealth?.addEventListener("click", () => {
      this.individualSortMode = "sorted";
      btnSortWealth.classList.remove("btn-secondary");
      btnSortWealth.classList.add("btn-primary");
      btnSortId?.classList.remove("btn-primary");
      btnSortId?.classList.add("btn-secondary");
      this.renderCanvas();
    });

    btnSortId?.addEventListener("click", () => {
      this.individualSortMode = "id";
      btnSortId.classList.remove("btn-secondary");
      btnSortId.classList.add("btn-primary");
      btnSortWealth?.classList.remove("btn-primary");
      btnSortWealth?.classList.add("btn-secondary");
      this.renderCanvas();
    });

    selectSample?.addEventListener("change", (e) => {
      this.individualSampleSize = e.target.value === "all" ? "all" : Number(e.target.value);
      this.renderCanvas();
    });

    btnClearTrack?.addEventListener("click", () => {
      this.clearTrackedAgent();
    });

    // キャンバス上のマウスイベント（ホバー＆クリック追跡）
    if (this.canvas) {
      this.canvas.addEventListener("mousemove", (e) => this.handleCanvasMouseMove(e));
      this.canvas.addEventListener("mouseleave", () => this.handleCanvasMouseLeave());
      this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    }

    // シード値手動入力
    document.getElementById("btn-apply-seed")?.addEventListener("click", () => {
      const customSeed = Number(this.elSeed.value);
      if (!isNaN(customSeed)) {
        this.seed = customSeed;
        this.reset();
      }
    });

    // 結果保存ボタン
    document.getElementById("btn-save-run")?.addEventListener("click", () => this.saveRunToDB());
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    if (this.engine.currentTurn >= this.engine.maxTurns) {
      this.reset();
    }
    this.isPlaying = true;
    this.updatePlayButton();
    if (this.elStatus) this.elStatus.innerText = "▶ 実行中";

    const tick = () => {
      if (!this.isPlaying) return;
      const ok = this.engine.step();
      this.updateUI();
      if (!ok || this.engine.currentTurn >= this.engine.maxTurns) {
        this.pause();
        if (this.elStatus) this.elStatus.innerText = "✔ 完了";
        this.addLogMessage(`シミュレーションがターン ${this.engine.currentTurn} で完了しました。`);
        return;
      }
      this.timer = setTimeout(tick, this.speedMs);
    };
    tick();
  }

  pause() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updatePlayButton();
    if (this.elStatus) this.elStatus.innerText = "⏸ 一時停止";
  }

  updatePlayButton() {
    const btn = document.getElementById("btn-play");
    if (btn) {
      btn.innerHTML = this.isPlaying
        ? '<span class="icon">⏸</span> 一時停止'
        : '<span class="icon">▶</span> 再生';
    }
  }
  step(n = 1) {
    this.pause();
    for (let i = 0; i < n; i++) {
      if (this.engine.currentTurn >= this.engine.maxTurns) break;
      const ok = this.engine.step();
      if (!ok) break;
    }
    this.updateUI();
  }

  stepBack(n = 1) {
    this.pause();
    const target = Math.max(0, this.engine.currentTurn - n);
    this.engine.restoreSnapshot(target);
    this.updateUI();
  }

  jumpStart() {
    this.pause();
    this.engine.restoreSnapshot(0);
    this.updateUI();
  }

  jumpEnd() {
    this.pause();
    while (this.engine.currentTurn < this.engine.maxTurns) {
      const ok = this.engine.step();
      if (!ok) break;
    }
    this.updateUI();
    if (this.elStatus) this.elStatus.innerText = "✔ 完了";
  }

  reset() {
    this.pause();
    this.engine = new SimulationEngine(this.config, this.seed);
    if (this.elSeed) this.elSeed.value = this.seed;
    if (this.elStatus) this.elStatus.innerText = "⏹ 待機中";
    if (this.elLogBox) this.elLogBox.innerHTML = '<div class="log-item">シミュレーションを初期化しました。</div>';
    this.updateUI();
  }

  newSeed() {
    this.seed = Math.floor(Math.random() * 90000000) + 10000000;
    this.reset();
  }

  addLogMessage(msg) {
    if (!this.elLogBox) return;
    const div = document.createElement("div");
    div.className = "log-item";
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.elLogBox.prepend(div);
  }

  updateUI() {
    const logs = this.engine.turnLogs;
    const current = logs[logs.length - 1] || {};
    const initial = logs[0] || {};

    if (this.elCurrentTurn) this.elCurrentTurn.innerText = this.engine.currentTurn;

    if (this.elGini) {
      this.elGini.innerText = current.gini_index !== undefined ? current.gini_index.toFixed(3) : "-";
      if (current.gini_index >= 0.4) {
        this.elGini.className = "kpi-value text-danger";
      } else if (current.gini_index >= 0.3) {
        this.elGini.className = "kpi-value text-warning";
      } else {
        this.elGini.className = "kpi-value text-success";
      }
    }

    if (this.elGiniDiff && initial.gini_index !== undefined && current.gini_index !== undefined) {
      const diff = current.gini_index - initial.gini_index;
      const sign = diff >= 0 ? "+" : "";
      this.elGiniDiff.innerText = `(${sign}${diff.toFixed(3)})`;
    }

    if (this.elSurvivors) {
      this.elSurvivors.innerText = `${current.survivor_count ?? 0} 人`;
    }

    if (this.elDropoutRate) {
      const total = this.engine.agents.length;
      const drop = total - (current.survivor_count ?? total);
      const rate = total > 0 ? (drop / total) * 100 : 0;
      this.elDropoutRate.innerText = `脱落: ${drop}人 (${rate.toFixed(1)}%)`;
    }

    if (this.elMeanWealth) this.elMeanWealth.innerText = `¥${(current.mean_wealth ?? 0).toLocaleString()}`;
    if (this.elMedianWealth) this.elMedianWealth.innerText = `¥${(current.median_wealth ?? 0).toLocaleString()}`;
    if (this.elTop1) this.elTop1.innerText = `${(current.top_1_share ?? 0).toFixed(1)}%`;
    if (this.elTop10) this.elTop10.innerText = `${(current.top_10_share ?? 0).toFixed(1)}%`;
    if (this.elBottom50) this.elBottom50.innerText = `${(current.bottom_50_share ?? 0).toFixed(1)}%`;

    // ヘッダー部コンパクトKPIの更新
    if (this.elHeaderGini && current.gini_index !== undefined) {
      this.elHeaderGini.innerText = current.gini_index.toFixed(3);
      if (current.gini_index >= 0.4) {
        this.elHeaderGini.style.color = "var(--danger)";
      } else if (current.gini_index >= 0.3) {
        this.elHeaderGini.style.color = "var(--warning)";
      } else {
        this.elHeaderGini.style.color = "var(--primary)";
      }
    }
    if (this.elHeaderSurvivors && current.survivor_count !== undefined) {
      this.elHeaderSurvivors.innerText = `${current.survivor_count} 人`;
    }
    if (this.elHeaderMean && current.mean_wealth !== undefined) {
      this.elHeaderMean.innerText = `¥${Math.round(current.mean_wealth).toLocaleString()}`;
    }

    // グラフ描画
    this.renderCanvas();
  }

  clearTrackedAgent() {
    this.trackedAgentId = null;
    const btn = document.getElementById("btn-indiv-clear-track");
    if (btn) btn.style.display = "none";
    this.renderCanvas();
  }

  handleCanvasMouseMove(e) {
    if (this.activeTab !== "individuals") return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let matched = null;
    for (const slot of this.renderedAgentSlots) {
      if (x >= slot.slotX1 && x <= slot.slotX2) {
        matched = slot;
        break;
      }
    }

    if (matched) {
      this.hoveredAgent = matched.agent;
      this.hoverCoords = { x, y, cx: matched.cx, slot: matched };
      this.canvas.style.cursor = "pointer";
    } else {
      this.hoveredAgent = null;
      this.hoverCoords = null;
      this.canvas.style.cursor = "default";
    }
    this.renderCanvas();
  }

  handleCanvasMouseLeave() {
    if (this.activeTab !== "individuals") return;
    this.hoveredAgent = null;
    this.hoverCoords = null;
    this.canvas.style.cursor = "default";
    this.renderCanvas();
  }

  handleCanvasClick(e) {
    if (this.activeTab !== "individuals") return;
    if (this.hoveredAgent) {
      if (this.trackedAgentId === this.hoveredAgent.id) {
        this.clearTrackedAgent();
      } else {
        this.trackedAgentId = this.hoveredAgent.id;
        const btn = document.getElementById("btn-indiv-clear-track");
        if (btn) {
          btn.style.display = "inline-block";
          btn.innerText = `📍 #${this.trackedAgentId} ピン解除`;
        }
        this.renderCanvas();
      }
    }
  }

  calculateNiceScale(maxVal) {
    if (maxVal <= 0) return 10000;
    const roughStep = maxVal / 4;
    const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const fraction = roughStep / power;
    const niceCandidates = [1, 1.2, 1.5, 2, 2.4, 2.5, 3, 4, 5, 6, 8, 10];
    let chosen = 10;
    for (const c of niceCandidates) {
      if (c >= fraction) {
        chosen = c;
        break;
      }
    }
    const step = chosen * power;
    return step * 4;
  }

  drawPersonIcon(ctx, cx, cy, w, h, color) {
    ctx.fillStyle = color;

    // 頭部
    const headRadius = Math.max(1.5, Math.min(w * 0.42, h * 0.17));
    const headY = cy + headRadius;
    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 胴体＋手足
    const bodyTop = headY + headRadius + 1;
    const bodyH = h - (bodyTop - cy);
    if (bodyH <= 2) return;

    const shoulderW = Math.max(2, Math.min(w, bodyH * 0.55));
    const armW = Math.max(0.6, shoulderW * 0.22);
    const torsoW = Math.max(1.2, shoulderW * 0.56);
    const legW = Math.max(0.6, torsoW * 0.42);
    const legStartY = bodyTop + bodyH * 0.45;
    const footY = cy + h;

    if (w < 4) {
      ctx.fillRect(cx - w / 2, bodyTop, w, bodyH);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2, bodyTop);
    ctx.lineTo(cx + shoulderW / 2, bodyTop);
    ctx.lineTo(cx + shoulderW / 2, legStartY);
    ctx.lineTo(cx + torsoW / 2, legStartY);
    ctx.lineTo(cx + torsoW / 2, footY);
    ctx.lineTo(cx + torsoW / 2 - legW, footY);
    ctx.lineTo(cx, legStartY + 3);
    ctx.lineTo(cx - torsoW / 2 + legW, footY);
    ctx.lineTo(cx - torsoW / 2, footY);
    ctx.lineTo(cx - torsoW / 2, legStartY);
    ctx.lineTo(cx - shoulderW / 2, legStartY);
    ctx.closePath();
    ctx.fill();
  }

  drawIndividualWealth(ctx, w, h) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const allAgents = this.engine.agents;
    if (!allAgents || allAgents.length === 0) return;

    let sortedAll = [];
    if (this.individualSortMode === "sorted") {
      sortedAll = [...allAgents].sort((a, b) => a.wealth - b.wealth);
    } else {
      sortedAll = [...allAgents].sort((a, b) => a.id - b.id);
    }

    let displayAgents = [];
    const sampleCount = this.individualSampleSize === "all" ? sortedAll.length : Math.min(100, sortedAll.length);
    if (sortedAll.length <= sampleCount) {
      displayAgents = sortedAll;
    } else {
      const step = (sortedAll.length - 1) / (sampleCount - 1);
      for (let i = 0; i < sampleCount; i++) {
        const idx = Math.min(sortedAll.length - 1, Math.round(i * step));
        displayAgents.push(sortedAll[idx]);
      }
      if (this.trackedAgentId) {
        const hasTracked = displayAgents.some(a => a.id === this.trackedAgentId);
        if (!hasTracked) {
          const target = allAgents.find(a => a.id === this.trackedAgentId);
          if (target) {
            if (this.individualSortMode === "sorted") {
              const insertIdx = displayAgents.findIndex(a => a.wealth >= target.wealth);
              if (insertIdx === -1) displayAgents.push(target);
              else displayAgents.splice(insertIdx, 0, target);
            } else {
              const insertIdx = displayAgents.findIndex(a => a.id >= target.id);
              if (insertIdx === -1) displayAgents.push(target);
              else displayAgents.splice(insertIdx, 0, target);
            }
          }
        }
      }
    }

    const n = displayAgents.length;
    if (n === 0) return;

    const maxW = Math.max(...displayAgents.map(a => a.wealth), 1);
    const minW = Math.min(...displayAgents.map(a => a.wealth));
    const scaleMax = this.calculateNiceScale(maxW);

    const padLeft = 100, padRight = 45, padTop = 50, padBottom = 48;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const y0 = padTop + chartH;

    // 水平破線グリッド（4分割）
    const divisions = 4;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;

    for (let i = 0; i <= divisions; i++) {
      const y = padTop + (chartH / divisions) * (divisions - i);
      const val = (scaleMax / divisions) * i;

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("¥" + Math.round(val).toLocaleString(), padLeft - 10, y + 4);
      ctx.restore();
    }
    ctx.setLineDash([]);

    // 個人のバーとピクトグラム
    const slotW = chartW / n;
    this.renderedAgentSlots = [];

    displayAgents.forEach((a, idx) => {
      const cx = padLeft + (idx + 0.5) * slotW;
      const slotX1 = padLeft + idx * slotW;
      const slotX2 = padLeft + (idx + 1) * slotW;
      this.renderedAgentSlots.push({ agent: a, cx, slotX1, slotX2, idx });

      const rawH = (a.wealth / scaleMax) * chartH;
      const barH = Math.max(2, rawH);
      const barW = Math.max(1.5, Math.min(6, slotW * 0.7));
      const barX = cx - barW / 2;
      const barY = y0 - barH;

      let barColor = "#3b115a";
      if (this.individualSortMode === "sorted") {
        if (idx === n - 1) {
          barColor = "#311465"; // トップ裕福層
        } else if (idx >= n - 4 && a.wealth > maxW * 0.05) {
          barColor = "#6b5b95"; // 準富裕層
        }
      } else {
        if (a.wealth === maxW && a.wealth > 0) barColor = "#311465";
      }

      const isTracked = (a.id === this.trackedAgentId);
      const isHovered = (this.hoveredAgent && this.hoveredAgent.id === a.id);

      if (isTracked || isHovered) {
        barColor = "#f59e0b";
      }

      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW, barH);

      const iconH = 18;
      const iconW = Math.max(2, Math.min(9, slotW * 0.75));
      const iconColor = (isTracked || isHovered) ? "#f59e0b" : "#3b115a";
      this.drawPersonIcon(ctx, cx, y0 + 3, iconW, iconH, iconColor);

      if (isTracked) {
        ctx.save();
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("📍", cx, barY - 14);
        ctx.fillText(`#${a.id}`, cx, barY - 4);
        ctx.restore();
      }
    });

    // アノテーション（注釈テキスト）
    this.drawIndividualAnnotations(ctx, w, h, displayAgents, scaleMax, chartW, chartH, padLeft, padTop, y0, slotW);

    // ツールチップ表示
    this.drawIndividualTooltip(ctx, w, h, allAgents, padLeft);
  }

  drawIndividualAnnotations(ctx, w, h, displayAgents, scaleMax, chartW, chartH, padLeft, padTop, y0, slotW) {
    const n = displayAgents.length;
    if (this.individualSortMode === "sorted") {
      const poorest = displayAgents[0];
      const richest = displayAgents[n - 1];

      const pRawH = (poorest.wealth / scaleMax) * chartH;
      const pBarY = y0 - Math.max(2, pRawH);
      ctx.fillStyle = "#581c87";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`最も貧しい: ¥${Math.round(poorest.wealth).toLocaleString()}`, padLeft + 2, pBarY - 10);

      const rRawH = (richest.wealth / scaleMax) * chartH;
      const rBarY = y0 - Math.max(2, rRawH);
      ctx.fillStyle = "#581c87";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "right";
      const richLabel = `最も裕福: ¥${Math.round(richest.wealth).toLocaleString()}`;
      const rLabelY = Math.max(padTop - 12, rBarY - 8);
      ctx.fillText(richLabel, padLeft + chartW, rLabelY);
    } else {
      let maxAgent = displayAgents[0];
      let maxIdx = 0;
      displayAgents.forEach((a, i) => {
        if (a.wealth > maxAgent.wealth) { maxAgent = a; maxIdx = i; }
      });

      const maxCx = padLeft + (maxIdx + 0.5) * slotW;
      const maxBarY = y0 - Math.max(2, (maxAgent.wealth / scaleMax) * chartH);
      ctx.fillStyle = "#581c87";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = maxCx > padLeft + chartW - 120 ? "right" : (maxCx < padLeft + 120 ? "left" : "center");
      ctx.fillText(`最も裕福 (#${maxAgent.id}): ¥${Math.round(maxAgent.wealth).toLocaleString()}`, maxCx, Math.max(padTop - 10, maxBarY - 8));
    }
  }

  drawIndividualTooltip(ctx, w, h, allAgents, padLeft) {
    if (!this.hoveredAgent || !this.hoverCoords) return;
    const a = this.hoveredAgent;
    const totalAgents = allAgents.length;
    const rank = allAgents.filter(o => o.wealth > a.wealth).length + 1;

    let diffText = "";
    if (this.engine.currentTurn > 0 && this.engine.historySnapshots[this.engine.currentTurn - 1]) {
      const prevSnap = this.engine.historySnapshots[this.engine.currentTurn - 1];
      const prevA = prevSnap.agents ? prevSnap.agents.find(x => x.id === a.id) : null;
      if (prevA) {
        const diff = a.wealth - prevA.wealth;
        if (diff > 0) diffText = ` (▲ +¥${Math.round(diff).toLocaleString()})`;
        else if (diff < 0) diffText = ` (▼ -¥${Math.round(Math.abs(diff)).toLocaleString()})`;
      }
    }

    const totalTrades = a.wins + a.losses;
    const winRate = totalTrades > 0 ? ((a.wins / totalTrades) * 100).toFixed(0) : "0";

    const lines = [
      `エージェント #${a.id} ${a.isAlive ? "● 生存" : "✕ 脱落"}`,
      `資産: ¥${Math.round(a.wealth).toLocaleString()}${diffText}`,
      `順位: ${rank} 位 / ${totalAgents} 人`,
      `成績: ${a.wins}勝 ${a.losses}敗 (勝率: ${winRate}%)`,
      `【クリックで追跡ピン留め】`
    ];

    ctx.save();
    ctx.font = "11px sans-serif";
    const boxW = 220;
    const boxH = lines.length * 18 + 12;
    let boxX = this.hoverCoords.cx - boxW / 2;
    if (boxX < padLeft) boxX = padLeft;
    if (boxX + boxW > w - 10) boxX = w - 10 - boxW;
    let boxY = this.hoverCoords.y - boxH - 12;
    if (boxY < 10) boxY = this.hoverCoords.y + 16;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    ctx.textAlign = "left";
    lines.forEach((line, li) => {
      if (li === 0) {
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 11px sans-serif";
      } else if (li === 1) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px monospace";
      } else if (li === lines.length - 1) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
      } else {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "11px sans-serif";
      }
      ctx.fillText(line, boxX + 10, boxY + 18 + li * 18);
    });
    ctx.restore();
  }

  renderCanvas() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.activeTab === "individuals") {
      this.drawIndividualWealth(ctx, w, h);
    } else if (this.activeTab === "histogram") {
      this.drawHistogram(ctx, w, h);
    } else if (this.activeTab === "yardsale") {
      this.drawYardSaleDynamics(ctx, w, h);
    } else if (this.activeTab === "trajectories") {
      this.drawWealthTrajectories(ctx, w, h);
    } else if (this.activeTab === "lorenz") {
      this.drawLorenzCurve(ctx, w, h);
    } else if (this.activeTab === "trend") {
      this.drawTrendChart(ctx, w, h);
    }
  }
  drawYardSaleDynamics(ctx, w, h) {
    const agents = this.engine.agents;
    const n = agents.length;
    if (n === 0) return;
    const initW = Number(this.config.initialWealth) || 10000;
    const sorted = [...agents].sort((a, b) => b.wealth - a.wealth);
    const top1Id = sorted[0]?.id;
    const top10Thresh = sorted[Math.max(0, Math.floor(n * 0.1) - 1)]?.wealth || initW;
    const medianThresh = sorted[Math.max(0, Math.floor(n * 0.5) - 1)]?.wealth || initW;

    const cx = w / 2, cy = h / 2 - 6, radius = Math.min(w, h) * 0.35;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const agentCoords = {};
    for (let i = 0; i < n; i++) {
      const a = agents[i], theta = (i / n) * Math.PI * 2 - Math.PI / 2;
      agentCoords[a.id] = { x: cx + radius * Math.cos(theta), y: cy + radius * Math.sin(theta), agent: a };
    }

    const txs = this.engine.lastTransactions || [];
    let maxTx = null;
    for (const t of txs) if (!maxTx || t.bet > maxTx.bet) maxTx = t;

    for (const tx of txs) {
      const lp = agentCoords[tx.loserId], wp = agentCoords[tx.winnerId];
      if (!lp || !wp) continue;
      const mx = (lp.x + wp.x) / 2 + (cx - (lp.x + wp.x) / 2) * 0.42;
      const my = (lp.y + wp.y) / 2 + (cy - (lp.y + wp.y) / 2) * 0.42;

      const grad = ctx.createLinearGradient(lp.x, lp.y, wp.x, wp.y);
      grad.addColorStop(0, "rgba(239, 68, 68, 0.35)");
      grad.addColorStop(0.7, "rgba(245, 158, 11, 0.7)");
      grad.addColorStop(1, "rgba(16, 185, 129, 0.85)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, Math.min(3.2, 0.8 + (tx.bet / (initW * 0.1)) * 1.5));
      ctx.beginPath();
      ctx.moveTo(lp.x, lp.y);
      ctx.quadraticCurveTo(mx, my, wp.x, wp.y);
      ctx.stroke();

      const t = 0.75;
      const px = (1 - t) * (1 - t) * lp.x + 2 * (1 - t) * t * mx + t * t * wp.x;
      const py = (1 - t) * (1 - t) * lp.y + 2 * (1 - t) * t * my + t * t * wp.y;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (maxTx && agentCoords[maxTx.winnerId]) {
      const wp = agentCoords[maxTx.winnerId];
      ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`+¥${Math.round(maxTx.bet).toLocaleString()}`, wp.x, wp.y - 12);
    }

    for (let i = 0; i < n; i++) {
      const a = agents[i], pt = agentCoords[a.id];
      if (!pt) continue;
      let r = 3, color = "#94a3b8";
      if (!a.isAlive) { r = 2; color = "#f43f5e"; }
      else {
        const ratio = Math.max(0, a.wealth) / initW;
        r = Math.max(2.5, Math.min(15, 3 + Math.sqrt(ratio) * 3.2));
        if (a.id === top1Id) color = "#f59e0b";
        else if (a.wealth >= top10Thresh) color = "#10b981";
        else if (a.wealth >= medianThresh) color = "#0284c7";
      }
      ctx.fillStyle = color;
      if (a.id === top1Id && a.isAlive) { ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 10; }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🤝 ヤードセール動態（エージェント取引ネットワーク & 富の移動フロー）", w / 2, 22);

    const legX = w - 165, legY = 14;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fillRect(legX - 6, legY - 4, 165, 58);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(legX - 6, legY - 4, 165, 58);
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f59e0b"; ctx.fillText("● Top 1 富豪", legX, legY + 10);
    ctx.fillStyle = "#10b981"; ctx.fillText("● Top 10% 上位", legX + 75, legY + 10);
    ctx.fillStyle = "#0284c7"; ctx.fillText("● 中流層", legX, legY + 26);
    ctx.fillStyle = "#94a3b8"; ctx.fillText("● 困窮層", legX + 75, legY + 26);
    ctx.fillStyle = "#f59e0b"; ctx.fillText("──► 敗者から勝者への富移動", legX, legY + 44);

    const stats = this.engine.getYardSaleStats();
    const hudW = w - 80, hudH = 32, hudX = 40, hudY = h - hudH - 8;
    ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(hudX, hudY, hudW, hudH);
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    const colW = hudW / 4;
    ctx.fillText(`今ターン取引: ${stats.transactionCount} 組`, hudX + 10, hudY + 20);
    ctx.fillText(`移動富総額: ¥${stats.totalTransferred.toLocaleString()}`, hudX + colW + 10, hudY + 20);
    const topT = stats.topAgent ? `#${stats.topAgent.id} (¥${stats.topAgent.wealth.toLocaleString()})` : "-";
    ctx.fillText(`首位富豪: ${topT}`, hudX + colW * 2 + 10, hudY + 20);
    ctx.fillText(`Top 1 寡占率: ${stats.oligarchyRatio}%`, hudX + colW * 3 + 10, hudY + 20);
  }

  drawWealthTrajectories(ctx, w, h) {
    const padLeft = 65, padBottom = 45, padTop = 45, padRight = 85;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const { agentIds, turns } = this.engine.getAgentTrajectories(35);
    if (!turns || turns.length === 0) return;

    const initW = Number(this.config.initialWealth) || 10000;
    const maxTurns = this.engine.maxTurns || 200;

    let maxWealth = initW * 2;
    for (const snap of turns) {
      for (const id of agentIds) {
        if (snap.wealths[id] && snap.wealths[id] > maxWealth) {
          maxWealth = snap.wealths[id];
        }
      }
    }
    maxWealth = Math.ceil(maxWealth * 1.15);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padTop + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      const labelVal = Math.round(maxWealth * (1 - i / 5));
      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText("¥" + labelVal.toLocaleString(), padLeft - 8, y + 4);
    }

    const initialY = padTop + chartH - (initW / maxWealth) * chartH;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, initialY);
    ctx.lineTo(w - padRight, initialY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("初期資産 (¥" + initW.toLocaleString() + ")", w - padRight + 6, initialY + 3);

    const lastTurnObj = turns[turns.length - 1];
    const sortedIds = [...agentIds].sort((a, b) => (lastTurnObj.wealths[b] || 0) - (lastTurnObj.wealths[a] || 0));

    for (const id of agentIds) {
      const rank = sortedIds.indexOf(id);
      const isTop3 = rank < 3;
      const isTop10 = rank < 10;

      let strokeColor = "rgba(148, 163, 184, 0.35)";
      let lineWidth = 1.0;

      if (rank === 0) {
        strokeColor = "#f59e0b";
        lineWidth = 3.0;
      } else if (rank === 1) {
        strokeColor = "#ea580c";
        lineWidth = 2.2;
      } else if (rank === 2) {
        strokeColor = "#10b981";
        lineWidth = 2.0;
      } else if (isTop10) {
        strokeColor = "rgba(2, 132, 199, 0.65)";
        lineWidth = 1.4;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let lastX = 0, lastY = 0;
      turns.forEach((snap, idx) => {
        const x = padLeft + (snap.turn / maxTurns) * chartW;
        const wVal = snap.wealths[id] !== undefined ? snap.wealths[id] : 0;
        const y = padTop + chartH - (wVal / maxWealth) * chartH;

        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (idx === turns.length - 1) {
          lastX = x;
          lastY = y;
        }
      });
      ctx.stroke();

      if (isTop3) {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = strokeColor;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        const wVal = lastTurnObj.wealths[id] || 0;
        ctx.fillText(` #${id} ¥${Math.round(wVal).toLocaleString()}`, lastX + 4, lastY + 3);
      }
    }

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📉 個別資産推移レース（ヤードセールのオリガルヒ化プロセス）", w / 2, 20);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.fillText("初期は全員平等だった資産から、1〜数本の線だけが天井へ突き抜け、大多数が0へ収束する現象", w / 2, 36);

    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText(`ターン (0 → ${maxTurns})`, w / 2, h - 10);
  }


  drawHistogram(ctx, w, h) {
    const logs = this.engine.turnLogs;
    const current = logs[logs.length - 1] || {};
    let bins = [];
    try {
      bins = JSON.parse(current.histogram_json || "[]");
    } catch (e) {
      bins = [];
    }
    if (bins.length === 0) return;

    const padLeft = 60, padBottom = 40, padTop = 30, padRight = 30;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const maxCount = Math.max(...bins.map(b => b.count), 10);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padTop + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      const labelVal = Math.round(maxCount * (1 - i / 5));
      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(labelVal, padLeft - 8, y + 4);
    }

    const barW = chartW / bins.length;
    bins.forEach((b, idx) => {
      const barH = (b.count / maxCount) * chartH;
      const x = padLeft + idx * barW + 4;
      const y = padTop + chartH - barH;
      const actualW = Math.max(2, barW - 8);

      const grad = ctx.createLinearGradient(0, y, 0, padTop + chartH);
      grad.addColorStop(0, "#3ea8ff");
      grad.addColorStop(1, "#0284c7");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, actualW, barH);

      ctx.fillStyle = "#475569";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x + actualW / 2, h - padBottom + 16);

      if (b.count > 0) {
        ctx.fillStyle = "#1e293b";
        ctx.font = "11px monospace";
        ctx.fillText(b.count, x + actualW / 2, y - 4);
      }
    });

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("資産階層分布ヒストグラム（人数）", w / 2, padTop - 10);
  }

  drawLorenzCurve(ctx, w, h) {
    const pad = 50;
    const size = Math.min(w - pad * 2, h - pad * 2);
    const startX = (w - size) / 2;
    const startY = (h - size) / 2;

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, size, size);

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(startX, startY + size);
    ctx.lineTo(startX + size, startY);
    ctx.stroke();
    ctx.setLineDash([]);

    const points = this.engine.getLorenzCurvePoints();
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + size);

      points.forEach(pt => {
        const px = startX + pt.x * size;
        const py = startY + size - pt.y * size;
        ctx.lineTo(px, py);
      });

      ctx.lineTo(startX + size, startY + size);
      ctx.closePath();
      ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(startX, startY + size);
      points.forEach(pt => {
        const px = startX + pt.x * size;
        const py = startY + size - pt.y * size;
        ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("累積人口シェア (0% → 100%)", w / 2, startY + size + 35);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("ローレンツ曲線 (完全平等線 vs 実分配)", w / 2, startY - 15);
  }

  drawTrendChart(ctx, w, h) {
    const logs = this.engine.turnLogs;
    if (logs.length < 2) return;

    const padLeft = 60, padBottom = 40, padTop = 30, padRight = 30;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padTop + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText((1 - i * 0.2).toFixed(1), padLeft - 8, y + 4);
    }

    ctx.beginPath();
    logs.forEach((log, idx) => {
      const x = padLeft + (log.turn / this.engine.maxTurns) * chartW;
      const y = padTop + chartH - (log.gini_index * chartH);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#3ea8ff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ジニ係数（格差）推移グラフ", w / 2, padTop - 10);
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText(`ターン (0 → ${this.engine.maxTurns})`, w / 2, h - padBottom + 25);
  }

  async saveRunToDB() {
    const btn = document.getElementById("btn-save-run");
    const saveMsg = document.getElementById("save-run-msg");
    if (btn) btn.disabled = true;
    if (saveMsg) saveMsg.innerText = "Tursoへ保存中...";

    try {
      const summary = this.engine.getSummary();
      const allLogs = this.engine.turnLogs;
      const filteredLogs = allLogs.filter(
        (l) => l.turn % 10 === 0 || l.turn === this.engine.currentTurn
      );

      const payload = {
        scenario_id: this.scenarioId,
        seed_value: this.seed,
        status: this.engine.currentTurn >= this.engine.maxTurns ? "completed" : "aborted",
        max_turns: this.engine.maxTurns,
        final_turn: this.engine.currentTurn,
        summary: summary,
        turn_logs: filteredLogs,
        event_logs: this.engine.eventLogs
      };

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("保存に失敗しました。");
      const data = await res.json();
      if (saveMsg) {
        saveMsg.innerHTML = `✔ 保存完了！ <a href="/runs/${data.run_id}" class="text-primary underline">詳細レポートを見る</a>`;
      }
      this.addLogMessage(`シミュレーション結果（Run ID: #${data.run_id.slice(0, 8)}）をTursoに保存しました。`);
    } catch (err) {
      if (saveMsg) saveMsg.innerText = `エラー: ${err.message}`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}

window.SimulatorUI = SimulatorUI;

