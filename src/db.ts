import type { Client, Row } from "@libsql/client/web";
import type { Scenario, SimulationRun, TurnLog, EventLog, ScenarioConfig, RunSummary } from "./types";

export function mapScenario(row: Row): Scenario {
  let cfg: ScenarioConfig | undefined;
  try {
    cfg = JSON.parse(String(row.config_json));
  } catch (e) {}

  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    title: String(row.title),
    description: String(row.description || ""),
    is_public: Number(row.is_public ?? 1),
    config_json: String(row.config_json),
    config: cfg,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapRun(row: Row): SimulationRun {
  let summary: RunSummary | undefined;
  try {
    if (row.summary_json) summary = JSON.parse(String(row.summary_json));
  } catch (e) {}

  let scenario_config: ScenarioConfig | undefined;
  try {
    if (row.scenario_config_json) {
      scenario_config = JSON.parse(String(row.scenario_config_json));
    }
  } catch (e) {}

  return {
    id: String(row.id),
    scenario_id: String(row.scenario_id),
    scenario_title: row.scenario_title ? String(row.scenario_title) : undefined,
    scenario_config,
    user_id: row.user_id ? String(row.user_id) : null,
    seed_value: Number(row.seed_value),
    status: (row.status as any) || "completed",
    max_turns: Number(row.max_turns),
    final_turn: Number(row.final_turn),
    parent_run_id: row.parent_run_id ? String(row.parent_run_id) : null,
    fork_at_turn: row.fork_at_turn ? Number(row.fork_at_turn) : null,
    summary_json: row.summary_json ? String(row.summary_json) : null,
    summary,
    created_at: String(row.created_at),
  };
}

export async function getScenarios(db: Client): Promise<Scenario[]> {
  const result = await db.execute(`
    SELECT s.*, MAX(r.created_at) AS last_run_at
    FROM scenarios s
    LEFT JOIN simulation_runs r ON s.id = r.scenario_id
    GROUP BY s.id
    ORDER BY 
      CASE WHEN MAX(r.created_at) IS NOT NULL THEN 0 ELSE 1 END,
      MAX(r.created_at) DESC,
      s.created_at DESC
  `);
  return result.rows.map(mapScenario);
}

export async function getScenario(db: Client, id: string): Promise<Scenario | null> {
  const result = await db.execute({
    sql: "SELECT * FROM scenarios WHERE id = ?",
    args: [id],
  });
  return result.rows[0] ? mapScenario(result.rows[0]) : null;
}

export async function createScenario(
  db: Client,
  data: { id: string; user_id: string | null; title: string; description: string; config: ScenarioConfig }
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO scenarios (id, user_id, title, description, is_public, config_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [data.id, data.user_id, data.title, data.description, JSON.stringify(data.config)],
  });
}

export async function updateScenario(
  db: Client,
  id: string,
  data: { title: string; description: string; config: ScenarioConfig }
): Promise<void> {
  await db.execute({
    sql: `UPDATE scenarios SET title = ?, description = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [data.title, data.description, JSON.stringify(data.config), id],
  });
}

export async function getScenarioRunCount(db: Client, scenarioId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM simulation_runs WHERE scenario_id = ?",
    args: [scenarioId],
  });
  return Number(result.rows[0]?.count ?? 0);
}

export async function deleteScenario(db: Client, id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM scenarios WHERE id = ?",
    args: [id],
  });
}

export async function getRecentRuns(db: Client, limit = 10): Promise<SimulationRun[]> {
  const result = await db.execute({
    sql: `SELECT r.*, s.title AS scenario_title, s.config_json AS scenario_config_json
          FROM simulation_runs r
          LEFT JOIN scenarios s ON s.id = r.scenario_id
          ORDER BY r.created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(mapRun);
}

export async function getRun(db: Client, id: string): Promise<SimulationRun | null> {
  const result = await db.execute({
    sql: `SELECT r.*, s.title AS scenario_title, s.config_json AS scenario_config_json
          FROM simulation_runs r
          LEFT JOIN scenarios s ON s.id = r.scenario_id
          WHERE r.id = ?`,
    args: [id],
  });
  return result.rows[0] ? mapRun(result.rows[0]) : null;
}

export async function getTurnLogs(db: Client, runId: string): Promise<TurnLog[]> {
  const result = await db.execute({
    sql: "SELECT * FROM turn_logs WHERE run_id = ? ORDER BY turn ASC",
    args: [runId],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    run_id: String(row.run_id),
    turn: Number(row.turn),
    gini_index: Number(row.gini_index),
    survivor_count: Number(row.survivor_count),
    mean_wealth: Number(row.mean_wealth),
    median_wealth: Number(row.median_wealth),
    top_1_share: Number(row.top_1_share),
    top_10_share: Number(row.top_10_share),
    bottom_50_share: Number(row.bottom_50_share),
    histogram_json: String(row.histogram_json || "[]"),
  }));
}

export async function getEventLogs(db: Client, runId: string): Promise<EventLog[]> {
  const result = await db.execute({
    sql: "SELECT * FROM event_logs WHERE run_id = ? ORDER BY turn ASC, id ASC",
    args: [runId],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    run_id: String(row.run_id),
    turn: Number(row.turn),
    event_type: String(row.event_type),
    message: String(row.message),
    event_detail_json: row.event_detail_json ? String(row.event_detail_json) : undefined,
    created_at: String(row.created_at),
  }));
}
