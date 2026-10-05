export interface ScenarioConfig {
  agentCount: number;
  maxTurns: number;
  initialWealth: number;
  wealthDistribution: "equal" | "unequal";
  unequalSettings?: {
    richRatio: number;
    richWealth: number;
    poorRatio: number;
    poorWealth: number;
  };
  waitRate: number; // 0-100 (%)
  investorRate: number; // 0-100 (%)
  investorReturnRate: number; // 0-100 (%)
  investorFailRate: number; // 0-100 (%)
  learningAgent: boolean;
  matchRule: "random" | "community";
  communityGroups?: number;
  strongAdvantage: boolean;
  strongAdvantageTopPercent?: number;
  strongAdvantageBonus?: number;
  betRule: "min_wealth" | "fixed_ratio";
  betRatio: number; // 0.0 - 1.0
  ubiEnabled: boolean;
  ubiAmount: number;
  progressiveTaxEnabled: boolean;
  progressiveTaxThreshold: number;
  progressiveTaxRate: number; // 0.0 - 1.0
  reliefEnabled: boolean;
  reliefRate: number; // 0.0 - 1.0
  inflationRate: number; // 0.0 - 1.0
  bankruptcyThreshold: number;
}

export interface Scenario {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  is_public: number;
  config_json: string;
  config?: ScenarioConfig;
  last_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationRun {
  id: string;
  scenario_id: string;
  scenario_title?: string;
  user_id: string | null;
  seed_value: number;
  status: "running" | "completed" | "aborted";
  max_turns: number;
  final_turn: number;
  parent_run_id: string | null;
  fork_at_turn: number | null;
  summary_json: string | null;
  summary?: RunSummary;
  created_at: string;
}

export interface RunSummary {
  initialGini: number;
  finalGini: number;
  giniChangeRate: number;
  initialSurvivors: number;
  finalSurvivors: number;
  dropoutCount: number;
  dropoutRate: number;
  finalMeanWealth: number;
  finalMedianWealth: number;
  top1Share: number;
  top10Share: number;
  bottom50Share: number;
}

export interface TurnLog {
  id?: number;
  run_id: string;
  turn: number;
  gini_index: number;
  survivor_count: number;
  mean_wealth: number;
  median_wealth: number;
  top_1_share: number;
  top_10_share: number;
  bottom_50_share: number;
  histogram_json: string;
}

export interface EventLog {
  id?: number;
  run_id: string;
  turn: number;
  event_type: string;
  message: string;
  event_detail_json?: string;
  created_at?: string;
}

export interface Agent {
  id: number;
  wealth: number;
  isAlive: boolean;
  personality: "conservative" | "normal" | "aggressive";
  streak: number; // 連続勝ち(+)、連続負け(-)
  wins: number;
  losses: number;
  communityId: number;
  dropoutTurn?: number;
}
