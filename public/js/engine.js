/**
 * ABWDS - Agent-Based Wealth Dynamics Simulator
 * 決定論的シミュレーションエンジン
 */

class PRNG {
  constructor(seed) {
    this.seed = (seed >>> 0) || 123456789;
  }
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

class SimulationEngine {
  constructor(config, seed = 12345) {
    this.seed = Number(seed);
    this.config = Object.assign({}, config);
    this.rng = new PRNG(this.seed);
    this.currentTurn = 0;
    this.maxTurns = Number(config.maxTurns) || 200;
    this.agents = [];
    this.turnLogs = [];
    this.eventLogs = [];
    this.historySnapshots = [];
    this.lastTransactions = [];
    this.init();
  }

  init() {
    this.rng = new PRNG(this.seed);
    this.currentTurn = 0;
    this.turnLogs = [];
    this.eventLogs = [];
    this.historySnapshots = [];
    this.lastTransactions = [];
    this.agents = [];

    const count = Number(this.config.agentCount) || 500;
    const initialWealth = Number(this.config.initialWealth) || 10000;
    const isUnequal = this.config.wealthDistribution === "unequal";
    const communityGroups = Number(this.config.communityGroups) || 4;

    const unequal = this.config.unequalSettings || {
      richRatio: 0.1,
      richWealth: initialWealth * 3,
      poorRatio: 0.2,
      poorWealth: initialWealth * 0.2
    };

    const richCount = isUnequal ? Math.floor(count * unequal.richRatio) : 0;
    const poorCount = isUnequal ? Math.floor(count * unequal.poorRatio) : 0;

    for (let i = 0; i < count; i++) {
      let wealth = initialWealth;
      if (isUnequal) {
        if (i < richCount) {
          wealth = Number(unequal.richWealth) || initialWealth * 3;
        } else if (i >= count - poorCount) {
          wealth = Number(unequal.poorWealth) || initialWealth * 0.2;
        }
      }

      this.agents.push({
        id: i + 1,
        wealth: Math.max(0, wealth),
        isAlive: true,
        personality: "normal",
        streak: 0,
        wins: 0,
        losses: 0,
        communityId: (i % communityGroups) + 1,
        dropoutTurn: null
      });
    }

    const initialKpi = this.calculateKPI();
    this.turnLogs.push({ turn: 0, ...initialKpi });
    this.saveSnapshot();
  }

  saveSnapshot() {
    this.historySnapshots[this.currentTurn] = {
      turn: this.currentTurn,
      agents: this.agents.map(a => ({
        id: a.id,
        wealth: a.wealth,
        isAlive: a.isAlive,
        personality: a.personality,
        streak: a.streak,
        wins: a.wins,
        losses: a.losses,
        dropoutTurn: a.dropoutTurn
      })),
      lastTransactions: [...this.lastTransactions],
      rngSeed: this.rng.seed
    };
  }

  restoreSnapshot(targetTurn) {
    if (targetTurn < 0) targetTurn = 0;
    if (targetTurn > this.turnLogs.length - 1) targetTurn = this.turnLogs.length - 1;
    const snap = this.historySnapshots[targetTurn];
    if (!snap) return false;

    this.currentTurn = targetTurn;
    this.rng.seed = snap.rngSeed;
    this.lastTransactions = snap.lastTransactions ? [...snap.lastTransactions] : [];
    this.agents = snap.agents.map(a => ({
      ...a,
      communityId: ((a.id - 1) % (Number(this.config.communityGroups) || 4)) + 1
    }));
    this.turnLogs = this.turnLogs.slice(0, targetTurn + 1);
    this.eventLogs = this.eventLogs.filter(e => e.turn <= targetTurn);
    return true;
  }

  step() {
    if (this.currentTurn >= this.maxTurns) return false;
    const aliveCount = this.agents.filter(a => a.isAlive).length;
    if (aliveCount <= 1) return false;

    this.currentTurn++;
    const cfg = this.config;

    // 1. 行動選択処理 (待機 / 投資 / ゼロサム対戦)
    const aliveAgents = this.agents.filter(a => a.isAlive);
    const waitingAgents = [];
    const investingAgents = [];
    const fightingAgents = [];

    const baseWaitRate = (Number(cfg.waitRate) || 0) / 100;
    const investorRate = (Number(cfg.investorRate) || 0) / 100;

    for (const a of aliveAgents) {
      let agentWaitRate = baseWaitRate;
      if (cfg.learningAgent) {
        if (a.personality === "conservative") agentWaitRate = Math.min(1.0, agentWaitRate + 0.15);
        if (a.personality === "aggressive") agentWaitRate = Math.max(0.0, agentWaitRate - 0.1);
      }

      if (this.rng.next() < agentWaitRate) {
        waitingAgents.push(a);
      } else if (this.rng.next() < investorRate) {
        investingAgents.push(a);
      } else {
        fightingAgents.push(a);
      }
    }

    // 投資家行動処理
    const invReturn = (Number(cfg.investorReturnRate) || 5) / 100;
    const invFail = (Number(cfg.investorFailRate) || 4) / 100;
    for (const a of investingAgents) {
      if (this.rng.next() < 0.5) {
        a.wealth += a.wealth * invReturn;
        a.wins++;
        a.streak = a.streak > 0 ? a.streak + 1 : 1;
      } else {
        a.wealth = Math.max(0, a.wealth - (a.wealth * invFail));
        a.losses++;
        a.streak = a.streak < 0 ? a.streak - 1 : -1;
      }
    }

    // 2. マッチング & 勝敗 & 取引
    const strongAdv = Boolean(cfg.strongAdvantage);
    const strongTopPercent = (Number(cfg.strongAdvantageTopPercent) || 10) / 100;
    const strongBonus = Number(cfg.strongAdvantageBonus) || 0.15;
    const betRatio = Math.max(0.01, Math.min(1.0, (Number(cfg.betRatio) || 0.1)));

    let richThreshold = Infinity;
    if (strongAdv && aliveAgents.length > 0) {
      const sorted = [...aliveAgents].sort((x, y) => y.wealth - x.wealth);
      const topIdx = Math.max(0, Math.floor(sorted.length * strongTopPercent) - 1);
      richThreshold = sorted[topIdx].wealth;
    }

    const pairs = [];
    if (cfg.matchRule === "community") {
      const groups = {};
      for (const a of fightingAgents) {
        if (!groups[a.communityId]) groups[a.communityId] = [];
        groups[a.communityId].push(a);
      }
      for (const gid in groups) {
        const mem = this.rng.shuffle(groups[gid]);
        for (let i = 0; i + 1 < mem.length; i += 2) pairs.push([mem[i], mem[i + 1]]);
      }
    } else {
      const shuffled = this.rng.shuffle([...fightingAgents]);
      for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    this.lastTransactions = [];
    for (const [a1, a2] of pairs) {
      let p1 = 0.5;
      const a1Rich = strongAdv && a1.wealth >= richThreshold;
      const a2Rich = strongAdv && a2.wealth >= richThreshold;
      if (a1Rich && !a2Rich) p1 = Math.min(0.9, 0.5 + strongBonus);
      else if (!a1Rich && a2Rich) p1 = Math.max(0.1, 0.5 - strongBonus);

      const a1Wins = this.rng.next() < p1;
      const winner = a1Wins ? a1 : a2;
      const loser = a1Wins ? a2 : a1;

      let bet = (cfg.betRule === "fixed_ratio")
        ? Math.min(loser.wealth, loser.wealth * betRatio)
        : Math.min(loser.wealth, Math.min(winner.wealth, loser.wealth) * betRatio);
      bet = Math.round(bet * 100) / 100;

      winner.wealth += bet;
      loser.wealth = Math.max(0, loser.wealth - bet);
      winner.wins++;
      loser.losses++;
      winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
      loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;

      this.lastTransactions.push({
        a1Id: a1.id,
        a2Id: a2.id,
        winnerId: winner.id,
        loserId: loser.id,
        bet: bet,
        p1: p1,
        winnerWealth: winner.wealth,
        loserWealth: loser.wealth
      });
    }

    // 5. 再分配 & 社会制度
    // 累進課税
    if (cfg.progressiveTaxEnabled) {
      const thresh = Number(cfg.progressiveTaxThreshold) || 20000;
      const rate = Math.max(0, Math.min(1.0, (Number(cfg.progressiveTaxRate) || 0.1)));
      for (const a of aliveAgents) {
        if (a.wealth > thresh) {
          const tax = (a.wealth - thresh) * rate;
          a.wealth -= tax;
        }
      }
    }

    // 弱者救済
    if (cfg.reliefEnabled) {
      const rate = Number(cfg.reliefRate) || 0.05;
      const sorted = [...aliveAgents].sort((x, y) => y.wealth - x.wealth);
      const topN = Math.max(1, Math.floor(sorted.length * 0.2));
      const bottomN = Math.max(1, Math.floor(sorted.length * 0.2));
      let pool = 0;
      for (let i = 0; i < topN; i++) {
        const transfer = sorted[i].wealth * rate * 0.5;
        sorted[i].wealth -= transfer;
        pool += transfer;
      }
      const perBottom = pool / bottomN;
      for (let i = sorted.length - bottomN; i < sorted.length; i++) {
        sorted[i].wealth += perBottom;
      }
    }

    // UBI
    if (cfg.ubiEnabled && Number(cfg.ubiAmount) > 0) {
      const ubi = Number(cfg.ubiAmount);
      for (const a of aliveAgents) a.wealth += ubi;
    }

    // インフレ
    const inflation = Number(cfg.inflationRate) || 0;
    if (inflation > 0) {
      for (const a of aliveAgents) a.wealth = Math.max(0, a.wealth * (1 - inflation));
    }

    // 6. 脱落判定
    const bankruptThresh = Number(cfg.bankruptcyThreshold) || 0;
    let newlyDropped = 0;
    for (const a of aliveAgents) {
      if (a.wealth < bankruptThresh) {
        a.isAlive = false;
        a.dropoutTurn = this.currentTurn;
        newlyDropped++;
      }
    }

    if (newlyDropped > 0 && newlyDropped >= aliveAgents.length * 0.05) {
      this.eventLogs.push({
        turn: this.currentTurn,
        event_type: "MASS_BANKRUPT",
        message: `Turn ${this.currentTurn}: 貧困脱落により ${newlyDropped} 名が退場しました。`
      });
    }

    // 7. 動的性格遷移 (学習エージェント)
    if (cfg.learningAgent) {
      for (const a of aliveAgents) {
        if (!a.isAlive) continue;
        if (a.streak >= 3) a.personality = "aggressive";
        else if (a.streak <= -3) a.personality = "conservative";
        else a.personality = "normal";
      }
    }

    for (const a of aliveAgents) a.wealth = Math.round(a.wealth * 100) / 100;

    const kpi = this.calculateKPI();
    this.turnLogs.push({ turn: this.currentTurn, ...kpi });
    this.saveSnapshot();
    return true;
  }

  updateConfigIntervention(updates, message = "パラメータが動的変更されました") {
    Object.assign(this.config, updates);
    this.eventLogs.push({
      turn: this.currentTurn,
      event_type: "POLICY_INTERVENTION",
      message: `Turn ${this.currentTurn}: ${message}`,
      event_detail_json: JSON.stringify(updates)
    });
  }

  calculateKPI() {
    const alive = this.agents.filter(a => a.isAlive);
    const survivorCount = alive.length;
    if (survivorCount === 0) {
      return {
        gini_index: 1.0,
        survivor_count: 0,
        mean_wealth: 0,
        median_wealth: 0,
        top_1_share: 0,
        top_10_share: 0,
        bottom_50_share: 0,
        histogram_json: JSON.stringify([])
      };
    }

    const sortedWealth = alive.map(a => a.wealth).sort((x, y) => x - y);
    const totalWealth = sortedWealth.reduce((acc, w) => acc + w, 0);

    const meanWealth = totalWealth / survivorCount;
    const midIdx = Math.floor(survivorCount / 2);
    const medianWealth = survivorCount % 2 === 0
      ? (sortedWealth[midIdx - 1] + sortedWealth[midIdx]) / 2
      : sortedWealth[midIdx];

    let gini = 0;
    if (totalWealth > 0 && survivorCount > 1) {
      let weightedSum = 0;
      for (let i = 0; i < survivorCount; i++) {
        weightedSum += (i + 1) * sortedWealth[i];
      }
      gini = (2 * weightedSum) / (survivorCount * totalWealth) - (survivorCount + 1) / survivorCount;
      gini = Math.max(0, Math.min(1.0, gini));
    }

    const top1Count = Math.max(1, Math.round(survivorCount * 0.01));
    const top10Count = Math.max(1, Math.round(survivorCount * 0.10));
    const bottom50Count = Math.max(1, Math.round(survivorCount * 0.50));

    const top1Wealth = sortedWealth.slice(-top1Count).reduce((a, b) => a + b, 0);
    const top10Wealth = sortedWealth.slice(-top10Count).reduce((a, b) => a + b, 0);
    const bottom50Wealth = sortedWealth.slice(0, bottom50Count).reduce((a, b) => a + b, 0);

    const top1Share = totalWealth > 0 ? (top1Wealth / totalWealth) * 100 : 0;
    const top10Share = totalWealth > 0 ? (top10Wealth / totalWealth) * 100 : 0;
    const bottom50Share = totalWealth > 0 ? (bottom50Wealth / totalWealth) * 100 : 0;

    const bins = [
      { label: "0-1k", min: 0, max: 1000, count: 0 },
      { label: "1k-3k", min: 1000, max: 3000, count: 0 },
      { label: "3k-5k", min: 3000, max: 5000, count: 0 },
      { label: "5k-10k", min: 5000, max: 10000, count: 0 },
      { label: "10k-20k", min: 10000, max: 20000, count: 0 },
      { label: "20k-40k", min: 20000, max: 40000, count: 0 },
      { label: "40k-80k", min: 40000, max: 80000, count: 0 },
      { label: "80k-150k", min: 80000, max: 150000, count: 0 },
      { label: "150k+", min: 150000, max: Infinity, count: 0 },
    ];

    for (const w of sortedWealth) {
      for (const bin of bins) {
        if (w >= bin.min && w < bin.max) {
          bin.count++;
          break;
        }
      }
    }

    return {
      gini_index: Math.round(gini * 1000) / 1000,
      survivor_count: survivorCount,
      mean_wealth: Math.round(meanWealth),
      median_wealth: Math.round(medianWealth),
      top_1_share: Math.round(top1Share * 10) / 10,
      top_10_share: Math.round(top10Share * 10) / 10,
      bottom_50_share: Math.round(bottom50Share * 10) / 10,
      histogram_json: JSON.stringify(bins)
    };
  }

  getLorenzCurvePoints() {
    const alive = this.agents.filter(a => a.isAlive);
    const n = alive.length;
    if (n === 0) return [{ x: 0, y: 0 }, { x: 1, y: 1 }];

    const sorted = alive.map(a => a.wealth).sort((a, b) => a - b);
    const total = sorted.reduce((sum, w) => sum + w, 0);
    if (total === 0) return [{ x: 0, y: 0 }, { x: 1, y: 1 }];

    const points = [{ x: 0, y: 0 }];
    const step = Math.max(1, Math.floor(n / 20));
    let cumWealth = 0;

    for (let i = 0; i < n; i++) {
      cumWealth += sorted[i];
      if ((i + 1) % step === 0 || i === n - 1) {
        points.push({
          x: Math.round(((i + 1) / n) * 1000) / 1000,
          y: Math.round((cumWealth / total) * 1000) / 1000
        });
      }
    }
    return points;
  }

  getSummary() {
    const initialLog = this.turnLogs[0] || {};
    const finalLog = this.turnLogs[this.turnLogs.length - 1] || {};
    const initialGini = initialLog.gini_index ?? 0;
    const finalGini = finalLog.gini_index ?? 0;
    const giniChange = initialGini > 0 ? ((finalGini - initialGini) / initialGini) * 100 : 0;

    const initialSurvivors = initialLog.survivor_count ?? this.agents.length;
    const finalSurvivors = finalLog.survivor_count ?? 0;
    const dropouts = initialSurvivors - finalSurvivors;
    const dropoutRate = initialSurvivors > 0 ? (dropouts / initialSurvivors) * 100 : 0;

    return {
      initialGini,
      finalGini,
      giniChangeRate: Math.round(giniChange * 10) / 10,
      initialSurvivors,
      finalSurvivors,
      dropoutCount: dropouts,
      dropoutRate: Math.round(dropoutRate * 10) / 10,
      finalMeanWealth: finalLog.mean_wealth ?? 0,
      finalMedianWealth: finalLog.median_wealth ?? 0,
      top1Share: finalLog.top_1_share ?? 0,
      top10Share: finalLog.top_10_share ?? 0,
      bottom50Share: finalLog.bottom_50_share ?? 0
    };
  }

  getYardSaleStats() {
    const txs = this.lastTransactions || [];
    const totalTransferred = txs.reduce((sum, t) => sum + t.bet, 0);
    let maxTx = null;
    for (const t of txs) {
      if (!maxTx || t.bet > maxTx.bet) maxTx = t;
    }
    const alive = this.agents.filter(a => a.isAlive);
    const totalWealth = alive.reduce((sum, a) => sum + a.wealth, 0);
    const sorted = [...alive].sort((a, b) => b.wealth - a.wealth);
    const top1 = sorted[0] || null;
    const top1Share = (top1 && totalWealth > 0) ? (top1.wealth / totalWealth) * 100 : 0;

    return {
      turn: this.currentTurn,
      transactionCount: txs.length,
      totalTransferred: Math.round(totalTransferred),
      maxTransaction: maxTx,
      topAgent: top1 ? { id: top1.id, wealth: Math.round(top1.wealth), share: Math.round(top1Share * 10) / 10 } : null,
      oligarchyRatio: Math.round(top1Share * 10) / 10
    };
  }

  getAgentTrajectories(sampleCount = 30) {
    if (this.historySnapshots.length === 0) return { agentIds: [], turns: [] };
    const total = this.agents.length;
    const count = Math.min(sampleCount, total);
    const chosenIds = new Set();

    // 均等サンプリング
    const step = total / count;
    for (let i = 0; i < count; i++) {
      chosenIds.add(Math.floor(i * step) + 1);
    }
    // 現在のTop 5エージェントも確実に含める
    const sortedCurrent = [...this.agents].sort((a, b) => b.wealth - a.wealth);
    for (let i = 0; i < Math.min(5, sortedCurrent.length); i++) {
      chosenIds.add(sortedCurrent[i].id);
    }

    const agentIds = Array.from(chosenIds);
    const turns = this.historySnapshots.map((snap, t) => {
      const map = {};
      for (const a of snap.agents) {
        if (chosenIds.has(a.id)) {
          map[a.id] = a.wealth;
        }
      }
      return { turn: t, wealths: map };
    });

    return { agentIds, turns };
  }
}

if (typeof window !== "undefined") {
  window.PRNG = PRNG;
  window.SimulationEngine = SimulationEngine;
}

export { PRNG, SimulationEngine };


