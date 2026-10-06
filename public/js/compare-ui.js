import { SimulationEngine } from "/js/engine.js";

export class CompareUI {
  constructor(options) {
    this.run1 = options.run1;
    this.run2 = options.run2;

    this.canvas = document.getElementById("canvas-compare-main");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.maxTurns = Math.min(Number(this.run1.max_turns) || 500, Number(this.run2.max_turns) || 500);

    this.currentTurn = 0;
    this.isPlaying = false;
    this.timer = null;
    this.speed = 60;

    this.barMode = "stacked"; // 'stacked' | 'grouped' | 'overlay'
    this.sortMode = "sorted";  // 'sorted' | 'id'
    this.sampleSize = "100";  // '100' or 'all'
    this.hoveredSlot = null;

    this.initEngines();
    this.bindDOM();
    this.render();
    this.updateUI();
  }

  initEngines() {
    const EngineClass = typeof SimulationEngine !== "undefined" ? SimulationEngine : window.SimulationEngine;
    this.engine1 = new EngineClass(this.run1.config, this.run1.seed_value);
    this.engine2 = new EngineClass(this.run2.config, this.run2.seed_value);
    this.currentTurn = 0;
  }
  bindDOM() {
    this.elPlay = document.getElementById("btn-comp-play");
    this.elTurn = document.getElementById("comp-turn-display");
    this.elSlider = document.getElementById("comp-turn-slider");
    this.elSpeed = document.getElementById("comp-speed-slider");

    this.elPlay?.addEventListener("click", () => this.togglePlay());
    document.getElementById("btn-comp-step-prev10")?.addEventListener("click", () => this.stepRelative(-10));
    document.getElementById("btn-comp-step-prev")?.addEventListener("click", () => this.stepRelative(-1));
    document.getElementById("btn-comp-step-next")?.addEventListener("click", () => this.stepRelative(1));
    document.getElementById("btn-comp-step-next10")?.addEventListener("click", () => this.stepRelative(10));
    document.getElementById("btn-comp-jump-start")?.addEventListener("click", () => this.jumpTo(0));
    document.getElementById("btn-comp-jump-end")?.addEventListener("click", () => this.jumpTo(this.maxTurns));
    document.getElementById("btn-comp-reset")?.addEventListener("click", () => this.reset());

    this.elSlider?.addEventListener("input", (e) => {
      this.pause();
      this.jumpTo(Number(e.target.value));
    });

    this.elSpeed?.addEventListener("input", (e) => {
      this.speed = Number(e.target.value);
      if (this.isPlaying) { this.pause(); this.play(); }
    });

    const setMode = (mode) => {
      this.barMode = mode;
      ["stacked", "grouped", "overlay"].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        btn?.classList.toggle("btn-primary", m === mode);
        btn?.classList.toggle("btn-secondary", m !== mode);
      });
      this.render();
    };
    document.getElementById("btn-mode-stacked")?.addEventListener("click", () => setMode("stacked"));
    document.getElementById("btn-mode-grouped")?.addEventListener("click", () => setMode("grouped"));
    document.getElementById("btn-mode-overlay")?.addEventListener("click", () => setMode("overlay"));

    const btnSortWealth = document.getElementById("btn-comp-sort-wealth");
    const btnSortId = document.getElementById("btn-comp-sort-id");
    btnSortWealth?.addEventListener("click", () => {
      this.sortMode = "sorted";
      btnSortWealth.classList.add("btn-primary");
      btnSortWealth.classList.remove("btn-secondary");
      btnSortId?.classList.add("btn-secondary");
      btnSortId?.classList.remove("btn-primary");
      this.render();
    });
    btnSortId?.addEventListener("click", () => {
      this.sortMode = "id";
      btnSortId.classList.add("btn-primary");
      btnSortId.classList.remove("btn-secondary");
      btnSortWealth?.classList.add("btn-secondary");
      btnSortWealth?.classList.remove("btn-primary");
      this.render();
    });

    document.getElementById("select-comp-sample")?.addEventListener("change", (e) => {
      this.sampleSize = e.target.value;
      this.render();
    });

    this.setupHover();
    window.addEventListener("resize", () => this.render());
  }

  setupHover() {
    if (!this.canvas) return;
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      if (!this.renderedSlots) return;
      const found = this.renderedSlots.find((s) => x >= s.slotX1 && x <= s.slotX2);
      this.hoveredSlot = found || null;
      this.canvas.style.cursor = found ? "pointer" : "default";
      this.render();
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredSlot = null;
      this.canvas.style.cursor = "default";
      this.render();
    });
  }

  togglePlay() { this.isPlaying ? this.pause() : this.play(); }

  play() {
    if (this.currentTurn >= this.maxTurns) this.reset();
    this.isPlaying = true;
    if (this.elPlay) this.elPlay.innerHTML = '<span class="icon">⏸</span> 一時停止';
    const getDelay = () => Math.round(180 - (Math.max(1, Math.min(100, this.speed)) / 100) * 165);
    const loop = () => {
      if (!this.isPlaying) return;
      if (this.currentTurn >= this.maxTurns) { this.pause(); return; }
      this.stepOne();
      this.timer = setTimeout(loop, getDelay());
    };
    this.timer = setTimeout(loop, getDelay());
  }

  pause() {
    this.isPlaying = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.elPlay) this.elPlay.innerHTML = '<span class="icon">▶</span> 同期再生';
  }

  stepOne() {
    if (this.currentTurn >= this.maxTurns) return;
    this.engine1.step();
    this.engine2.step();
    this.currentTurn = this.engine1.currentTurn;
    this.render();
    this.updateUI();
  }

  stepRelative(diff) {
    this.pause();
    this.jumpTo(Math.max(0, Math.min(this.maxTurns, this.currentTurn + diff)));
  }

  jumpTo(targetTurn) {
    this.pause();
    targetTurn = Math.max(0, Math.min(this.maxTurns, targetTurn));
    if (targetTurn < this.currentTurn || targetTurn === 0) this.initEngines();
    while (this.currentTurn < targetTurn) {
      this.engine1.step();
      this.engine2.step();
      this.currentTurn = this.engine1.currentTurn;
    }
    this.render();
    this.updateUI();
  }

  reset() {
    this.pause();
    this.initEngines();
    this.render();
    this.updateUI();
  }

  calculateNiceScale(maxVal) {
    if (maxVal <= 0) return 10000;
    const roughStep = maxVal / 4;
    const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const fraction = roughStep / power;
    const niceCandidates = [1, 1.2, 1.5, 2, 2.4, 2.5, 3, 4, 5, 6, 8, 10];
    let chosen = 10;
    for (const c of niceCandidates) {
      if (c >= fraction) { chosen = c; break; }
    }
    return chosen * power * 4;
  }

  drawPersonIcon(ctx, cx, cy, w, h, color) {
    ctx.fillStyle = color;
    const headRadius = Math.max(1.5, Math.min(w * 0.42, h * 0.17));
    const headY = cy + headRadius;
    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    const bodyTop = headY + headRadius + 1;
    const bodyH = h - (bodyTop - cy);
    if (bodyH <= 2) return;

    const shoulderW = Math.max(2, Math.min(w, bodyH * 0.55));
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

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const agents1 = this.engine1.agents || [];
    const agents2 = this.engine2.agents || [];
    if (agents1.length === 0 || agents2.length === 0) return;

    const map2 = new Map(agents2.map((a) => [a.id, a]));
    let pairs = agents1.map((a1) => {
      const a2 = map2.get(a1.id) || { id: a1.id, wealth: 0, isAlive: false };
      return { id: a1.id, w1: a1.wealth, w2: a2.wealth, a1, a2 };
    });

    if (this.sortMode === "sorted") {
      pairs.sort((a, b) => a.w1 - b.w1);
    } else {
      pairs.sort((a, b) => a.id - b.id);
    }

    const sampleCount = this.sampleSize === "all" ? pairs.length : Math.min(100, pairs.length);
    let displayPairs = [];
    if (pairs.length <= sampleCount) {
      displayPairs = pairs;
    } else {
      const step = (pairs.length - 1) / (sampleCount - 1);
      for (let i = 0; i < sampleCount; i++) {
        const idx = Math.min(pairs.length - 1, Math.round(i * step));
        displayPairs.push(pairs[idx]);
      }
    }

    const n = displayPairs.length;
    if (n === 0) return;

    let maxVal = 1;
    if (this.barMode === "stacked") {
      maxVal = Math.max(...displayPairs.map((p) => p.w1 + p.w2), 1);
    } else {
      maxVal = Math.max(...displayPairs.map((p) => Math.max(p.w1, p.w2)), 1);
    }
    const scaleMax = this.calculateNiceScale(maxVal);

    const padLeft = 85, padRight = 35, padTop = 50, padBottom = 34;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const y0 = padTop + chartH;

    // 水平破線グリッド
    const divisions = 4;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#e2e8f0";
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
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("¥" + Math.round(val).toLocaleString(), padLeft - 8, y + 4);
      ctx.restore();
    }
    ctx.setLineDash([]);

    const slotW = chartW / n;
    this.renderedSlots = [];

    displayPairs.forEach((p, idx) => {
      const cx = padLeft + (idx + 0.5) * slotW;
      const slotX1 = padLeft + idx * slotW;
      const slotX2 = padLeft + (idx + 1) * slotW;
      this.renderedSlots.push({ pair: p, cx, slotX1, slotX2, idx });

      const isHovered = this.hoveredSlot && this.hoveredSlot.pair.id === p.id;
      const barW = Math.max(2, Math.min(8, slotW * 0.72));

      if (this.barMode === "stacked") {
        // 積み上げ棒グラフ (下段: 施行A, 上段: 施行B)
        const h1 = Math.max(1, (p.w1 / scaleMax) * chartH);
        const h2 = Math.max(1, (p.w2 / scaleMax) * chartH);
        const y1 = y0 - h1;
        const y2 = y1 - h2;

        ctx.fillStyle = isHovered ? "#3b82f6" : "#2563eb";
        ctx.fillRect(cx - barW / 2, y1, barW, h1);

        ctx.fillStyle = isHovered ? "#a855f7" : "#7c3aed";
        ctx.fillRect(cx - barW / 2, y2, barW, h2);

        const iconColor = isHovered ? "#ef4444" : "#475569";
        this.drawPersonIcon(ctx, cx, y0 + 2, Math.max(2, Math.min(8, slotW * 0.75)), 14, iconColor);
      } else if (this.barMode === "grouped") {
        // 並列棒グラフ
        const subW = Math.max(1.5, barW / 2);
        const h1 = Math.max(1, (p.w1 / scaleMax) * chartH);
        const h2 = Math.max(1, (p.w2 / scaleMax) * chartH);

        ctx.fillStyle = isHovered ? "#3b82f6" : "#2563eb";
        ctx.fillRect(cx - subW, y0 - h1, subW, h1);

        ctx.fillStyle = isHovered ? "#a855f7" : "#7c3aed";
        ctx.fillRect(cx, y0 - h2, subW, h2);

        this.drawPersonIcon(ctx, cx, y0 + 2, Math.max(2, Math.min(8, slotW * 0.75)), 14, isHovered ? "#ef4444" : "#475569");
      } else {
        // 重ね合わせ棒グラフ
        const h1 = Math.max(1, (p.w1 / scaleMax) * chartH);
        const h2 = Math.max(1, (p.w2 / scaleMax) * chartH);

        ctx.fillStyle = "rgba(37, 99, 235, 0.65)";
        ctx.fillRect(cx - barW / 2, y0 - h1, barW, h1);

        ctx.fillStyle = "rgba(124, 58, 237, 0.65)";
        ctx.fillRect(cx - barW / 2, y0 - h2, barW, h2);

        this.drawPersonIcon(ctx, cx, y0 + 2, Math.max(2, Math.min(8, slotW * 0.75)), 14, isHovered ? "#ef4444" : "#475569");
      }
    });

    this.drawLegend(ctx, padLeft, chartW);
    if (this.hoveredSlot) {
      this.drawHoverTooltip(ctx, this.hoveredSlot.pair, w, padLeft, padRight);
    }
  }
  drawLegend(ctx, padLeft, chartW) {
    ctx.save();
    const r1Ratio = this.run1.config?.betRatio !== undefined ? `${Math.round(this.run1.config.betRatio * 100)}%` : "-";
    const r2Ratio = this.run2.config?.betRatio !== undefined ? `${Math.round(this.run2.config.betRatio * 100)}%` : "-";

    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";

    // 施行A
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(padLeft, 14, 12, 12);
    ctx.fillStyle = "#1e293b";
    ctx.fillText(`施行A: 比率 ${r1Ratio} (下段)`, padLeft + 16, 24);

    // 施行B
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(padLeft + 160, 14, 12, 12);
    ctx.fillStyle = "#1e293b";
    ctx.fillText(`施行B: 比率 ${r2Ratio} (上段/積上)`, padLeft + 176, 24);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    const modeLabel = this.barMode === "stacked" ? "積み上げ表示" : this.barMode === "grouped" ? "並列表示" : "重ね合わせ表示";
    ctx.fillText(`表示: ${modeLabel}`, padLeft + chartW, 24);
    ctx.restore();
  }

  drawHoverTooltip(ctx, pair, w, padLeft, padRight) {
    const tipW = 210, tipH = 72;
    const tx = Math.min(w - padRight - tipW, Math.max(padLeft, w / 2 - tipW / 2));
    const ty = 34;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tipW, tipH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`エージェント #${pair.id}`, tx + 10, ty + 16);

    ctx.fillStyle = "#93c5fd";
    ctx.font = "11px monospace";
    ctx.fillText(`施行A: ¥${Math.round(pair.w1).toLocaleString()}`, tx + 10, ty + 32);

    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(`施行B: ¥${Math.round(pair.w2).toLocaleString()}`, tx + 10, ty + 48);

    const diff = pair.w2 - pair.w1;
    ctx.fillStyle = diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#94a3b8";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`差異(B-A): ${diff >= 0 ? "+" : ""}¥${Math.round(diff).toLocaleString()}`, tx + 10, ty + 64);
    ctx.restore();
  }

  updateUI() {
    if (this.elTurn) this.elTurn.textContent = `Turn ${this.currentTurn} / ${this.maxTurns}`;
    if (this.elSlider) this.elSlider.value = this.currentTurn;

    const kpi1 = this.engine1.getSummary();
    const kpi2 = this.engine2.getSummary();
    const g1 = this.engine1.turnLogs[this.currentTurn]?.gini_index ?? (kpi1.finalGini || 0);
    const g2 = this.engine2.turnLogs[this.currentTurn]?.gini_index ?? (kpi2.finalGini || 0);
    const s1 = this.engine1.turnLogs[this.currentTurn]?.survivor_count ?? (kpi1.finalSurvivors || 0);
    const s2 = this.engine2.turnLogs[this.currentTurn]?.survivor_count ?? (kpi2.finalSurvivors || 0);
    const max1 = Math.max(...(this.engine1.agents || []).map((a) => a.wealth), 0);
    const max2 = Math.max(...(this.engine2.agents || []).map((a) => a.wealth), 0);
    const med1 = this.engine1.turnLogs[this.currentTurn]?.median_wealth ?? (kpi1.finalMedianWealth || 0);
    const med2 = this.engine2.turnLogs[this.currentTurn]?.median_wealth ?? (kpi2.finalMedianWealth || 0);

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT("kpi-live-gini-1", g1.toFixed(3));
    setT("kpi-live-gini-2", g2.toFixed(3));
    setT("kpi-live-surv-1", `${s1}人`);
    setT("kpi-live-surv-2", `${s2}人`);
    setT("kpi-live-max-1", `¥${Math.round(max1).toLocaleString()}`);
    setT("kpi-live-max-2", `¥${Math.round(max2).toLocaleString()}`);
    setT("kpi-live-median-1", `¥${Math.round(med1).toLocaleString()}`);
    setT("kpi-live-median-2", `¥${Math.round(med2).toLocaleString()}`);

    const diffG = g2 - g1;
    const elG = document.getElementById("kpi-diff-gini");
    if (elG) {
      elG.textContent = diffG >= 0 ? `+${diffG.toFixed(3)}` : diffG.toFixed(3);
      elG.style.color = diffG > 0 ? "var(--danger)" : "var(--success)";
    }
    const diffS = s2 - s1;
    const elS = document.getElementById("kpi-diff-surv");
    if (elS) {
      elS.textContent = diffS >= 0 ? `+${diffS}人` : `${diffS}人`;
      elS.style.color = diffS >= 0 ? "var(--success)" : "var(--danger)";
    }
    const diffM = max2 - max1;
    const elM = document.getElementById("kpi-diff-max");
    if (elM) {
      elM.textContent = diffM >= 0 ? `+¥${Math.round(diffM).toLocaleString()}` : `-¥${Math.round(Math.abs(diffM)).toLocaleString()}`;
      elM.style.color = diffM > 0 ? "var(--danger)" : "var(--text-muted)";
    }
  }


}
window.CompareUI = CompareUI;
