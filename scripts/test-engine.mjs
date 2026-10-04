import { PRNG, SimulationEngine } from "../public/js/engine.js";

const config = {
  agentCount: 100,
  maxTurns: 50,
  initialWealth: 10000,
  wealthDistribution: "equal",
  waitRate: 10,
  investorRate: 10,
  investorReturnRate: 5,
  investorFailRate: 4,
  learningAgent: true,
  matchRule: "random",
  strongAdvantage: true,
  strongAdvantageTopPercent: 10,
  strongAdvantageBonus: 0.15,
  betRule: "min_wealth",
  betRatio: 0.1,
  ubiEnabled: true,
  ubiAmount: 200,
  progressiveTaxEnabled: true,
  progressiveTaxThreshold: 15000,
  progressiveTaxRate: 0.1,
  reliefEnabled: true,
  reliefRate: 0.05,
  inflationRate: 0.01,
  bankruptcyThreshold: 500
};

const engine = new SimulationEngine(config, 42);
console.log("Turn 0 KPI:", engine.turnLogs[0]);

for (let i = 0; i < 50; i++) {
  engine.step();
}

console.log("Turn 50 KPI:", engine.turnLogs[engine.turnLogs.length - 1]);
console.log("Summary:", engine.getSummary());
console.log("Lorenz Points (sample 5):", engine.getLorenzCurvePoints().slice(0, 5));
console.log("YardSale Stats:", engine.getYardSaleStats());
console.log("Agent Trajectories sample agent count:", engine.getAgentTrajectories(10).agentIds.length);
