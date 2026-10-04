import fs from "fs";
import { createClient } from "@libsql/client";

const envFile = fs.readFileSync(".dev.vars", "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const defaultScenarios = [
  {
    id: "scen-laissez-faire",
    title: "標準自由放任モデル（市場経済の基礎）",
    description: "完全平等な初期条件から、ランダム取引を繰り返すだけで自然と富の格差（パレート法則）が形成されるかを検証する基本シナリオ。",
    config: {
      agentCount: 500,
      maxTurns: 200,
      initialWealth: 10000,
      wealthDistribution: "equal",
      waitRate: 5,
      investorRate: 0,
      investorReturnRate: 5,
      investorFailRate: 4,
      learningAgent: false,
      matchRule: "random",
      strongAdvantage: false,
      strongAdvantageTopPercent: 10,
      strongAdvantageBonus: 0.15,
      betRule: "min_wealth",
      betRatio: 0.1,
      ubiEnabled: false,
      ubiAmount: 0,
      progressiveTaxEnabled: false,
      progressiveTaxThreshold: 20000,
      progressiveTaxRate: 0.1,
      reliefEnabled: false,
      reliefRate: 0.05,
      inflationRate: 0.0,
      bankruptcyThreshold: 100
    }
  },
  {
    id: "scen-welfare-nordic",
    title: "北欧型福祉モデル（累進課税＋ベーシックインカム）",
    description: "累進課税とUBI（毎ターン定額給付）により、市場取引による格差拡大をどこまで是正できるかを検証するシナリオ。",
    config: {
      agentCount: 500,
      maxTurns: 200,
      initialWealth: 10000,
      wealthDistribution: "equal",
      waitRate: 10,
      investorRate: 10,
      investorReturnRate: 5,
      investorFailRate: 4,
      learningAgent: true,
      matchRule: "random",
      strongAdvantage: false,
      strongAdvantageTopPercent: 10,
      strongAdvantageBonus: 0.15,
      betRule: "min_wealth",
      betRatio: 0.1,
      ubiEnabled: true,
      ubiAmount: 300,
      progressiveTaxEnabled: true,
      progressiveTaxThreshold: 18000,
      progressiveTaxRate: 0.15,
      reliefEnabled: true,
      reliefRate: 0.05,
      inflationRate: 0.01,
      bankruptcyThreshold: 500
    }
  },
  {
    id: "scen-hyper-capitalism",
    title: "格差加速・資本主義激化モデル（強者優遇＋インフレ＋脱落）",
    description: "資産上位者の勝率補正、投資家行動、インフレによる固定目減り、貧困脱落が組み合わさった過酷な格差拡大シナリオ。",
    config: {
      agentCount: 500,
      maxTurns: 200,
      initialWealth: 10000,
      wealthDistribution: "unequal",
      unequalSettings: {
        richRatio: 0.1,
        richWealth: 30000,
        poorRatio: 0.2,
        poorWealth: 2000
      },
      waitRate: 15,
      investorRate: 30,
      investorReturnRate: 8,
      investorFailRate: 6,
      learningAgent: true,
      matchRule: "random",
      strongAdvantage: true,
      strongAdvantageTopPercent: 10,
      strongAdvantageBonus: 0.15,
      betRule: "min_wealth",
      betRatio: 0.15,
      ubiEnabled: false,
      ubiAmount: 0,
      progressiveTaxEnabled: false,
      progressiveTaxThreshold: 30000,
      progressiveTaxRate: 0.05,
      reliefEnabled: false,
      reliefRate: 0,
      inflationRate: 0.02,
      bankruptcyThreshold: 1000
    }
  },
  {
    id: "scen-pure-yardsale",
    title: "純粋ヤードセールモデル（格差の凝縮・オリガルヒ検証）",
    description: "再分配（税やUBI）を一切行わず、公平な50%コイントス取引のみを繰り返す理論モデル。数学的に富が必然的に1人に独占（凝縮）されていくヤードセール現象を観察できます。",
    config: {
      agentCount: 500,
      maxTurns: 300,
      initialWealth: 10000,
      wealthDistribution: "equal",
      waitRate: 0,
      investorRate: 0,
      investorReturnRate: 5,
      investorFailRate: 4,
      learningAgent: false,
      matchRule: "random",
      strongAdvantage: false,
      strongAdvantageTopPercent: 10,
      strongAdvantageBonus: 0.15,
      betRule: "min_wealth",
      betRatio: 0.15,
      ubiEnabled: false,
      ubiAmount: 0,
      progressiveTaxEnabled: false,
      progressiveTaxThreshold: 20000,
      progressiveTaxRate: 0.1,
      reliefEnabled: false,
      reliefRate: 0.05,
      inflationRate: 0.0,
      bankruptcyThreshold: 0
    }
  },
  {
    id: "scen-community-clique",
    title: "コネ社会・分断モデル（地域限定マッチング）",
    description: "4つの地域グループ内でのみ取引が制限される社会。地域間の初期格差や閉鎖環境が全体の富の動態にどう影響するかを検証。",
    config: {
      agentCount: 500,
      maxTurns: 200,
      initialWealth: 10000,
      wealthDistribution: "unequal",
      unequalSettings: {
        richRatio: 0.15,
        richWealth: 25000,
        poorRatio: 0.15,
        poorWealth: 3000
      },
      waitRate: 10,
      investorRate: 15,
      investorReturnRate: 6,
      investorFailRate: 5,
      learningAgent: true,
      matchRule: "community",
      communityGroups: 4,
      strongAdvantage: true,
      strongAdvantageTopPercent: 10,
      strongAdvantageBonus: 0.1,
      betRule: "min_wealth",
      betRatio: 0.1,
      ubiEnabled: true,
      ubiAmount: 150,
      progressiveTaxEnabled: true,
      progressiveTaxThreshold: 22000,
      progressiveTaxRate: 0.1,
      reliefEnabled: false,
      reliefRate: 0,
      inflationRate: 0.01,
      bankruptcyThreshold: 500
    }
  }
];

async function runMigration() {
  try {
    console.log("Applying 0003_abwds_schema.sql...");
    const sql3 = fs.readFileSync("migrations/0003_abwds_schema.sql", "utf8");
    const statements = sql3
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      console.log("Executing:", stmt.slice(0, 50).replace(/\s+/g, ' ') + "...");
      await client.execute(stmt);
    }
    console.log("0003_abwds_schema.sql applied successfully.");

    console.log("Seeding default scenarios...");
    for (const scen of defaultScenarios) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO scenarios (id, user_id, title, description, is_public, config_json, updated_at)
              VALUES (?, NULL, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
        args: [scen.id, scen.title, scen.description, JSON.stringify(scen.config)]
      });
      console.log(`Seeded scenario: ${scen.title}`);
    }

    const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("Current tables in DB:", tablesRes.rows.map(r => r.name));

    const scenariosRes = await client.execute("SELECT id, title FROM scenarios;");
    console.log("Current scenarios count:", scenariosRes.rows.length);
    console.log(scenariosRes.rows);
  } catch (err) {
    console.error("Migration/Seed error:", err);
  }
}

runMigration();

