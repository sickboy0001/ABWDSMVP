import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createClient, type Client } from "@libsql/client/web";
import {
  createPkceChallenge,
  createSessionToken,
  randomToken,
  verifyGoogleIdToken,
  verifySessionToken,
  type AuthUser,
  type GoogleProfile,
} from "./auth";
import {
  getScenarios,
  getScenario,
  createScenario,
  updateScenario,
  getRecentRuns,
  getRun,
  getTurnLogs,
  getEventLogs,
} from "./db";
import type { ScenarioConfig, RunSummary, TurnLog, EventLog } from "./types";
import { Layout } from "./views/layout";
import { ScenarioListView } from "./views/scenario_list";
import { SimulatorView } from "./views/simulator_view";
import { ScenarioFormView } from "./views/scenario_form";
import { RunsListView } from "./views/runs_list";
import { RunReportView } from "./views/run_report";

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string;
  APP_BASE_URL: string;
};

export const app = new Hono<{
  Bindings: Bindings;
  Variables: { db: Client; user: AuthUser | null };
}>();

app.use("*", async (c, next) => {
  const db = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  });
  c.set("db", db);
  try {
    let user: AuthUser | null = null;
    const session = getCookie(c, "__Host-session");
    if (session && c.env.AUTH_SECRET?.length >= 32) {
      try {
        const payload = await verifySessionToken(c.env.AUTH_SECRET, session);
        if (typeof payload.sub === "string") {
          const result = await db.execute({
            sql: "SELECT id, email, display_name, image_url, is_admin FROM users WHERE id = ?",
            args: [payload.sub],
          });
          const row = result.rows[0];
          if (row) {
            user = {
              id: String(row.id),
              email: String(row.email),
              displayName: String(row.display_name),
              imageUrl: row.image_url ? String(row.image_url) : null,
              isAdmin: Boolean(Number(row.is_admin)),
            };
          }
        }
      } catch {}
    }
    c.set("user", user);
    await next();
  } finally {
    db.close();
  }
});

// 認証関連ルート
app.get("/login", (c) => {
  return c.html(
    <Layout user={c.get("user")} activeNav="login">
      <div style="max-width: 440px; margin: 40px auto; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 32px; text-align: center; box-shadow: var(--shadow-md);">
        <h1 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 8px;">ABWDS ログイン</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">
          Googleアカウントでログインすると、シナリオの作成者記録や個別履歴が保持されます。
        </p>
        <a href="/api/auth/login/google" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1rem;">
          Googleでログイン
        </a>
        <div style="margin-top: 20px;">
          <a href="/" style="font-size: 0.85rem; color: var(--text-dim);">ログインせずに利用する →</a>
        </div>
      </div>
    </Layout>
  );
});

app.get("/api/auth/login/google", async (c) => {
  const verifier = randomToken(48);
  const codeChallenge = await createPkceChallenge(verifier);
  const state = randomToken(32);
  const nonce = randomToken(32);
  setCookie(c, "g_state", state, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });
  setCookie(c, "g_verifier", verifier, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });
  setCookie(c, "g_nonce", nonce, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", c.env.APP_BASE_URL + "/api/auth/callback/google");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return c.redirect(url.toString(), 302);
});

app.get("/api/auth/callback/google", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieState = getCookie(c, "g_state");
  const verifier = getCookie(c, "g_verifier");
  const nonce = getCookie(c, "g_nonce");
  deleteCookie(c, "g_state", { path: "/" });
  deleteCookie(c, "g_verifier", { path: "/" });
  deleteCookie(c, "g_nonce", { path: "/" });

  if (!code || !state || !cookieState || state !== cookieState || !verifier || !nonce) {
    return c.redirect("/login?error=invalid_state");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.APP_BASE_URL + "/api/auth/callback/google",
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return c.redirect("/login?error=token_failed");
  const tokenData = await tokenRes.json<{ id_token: string }>();

  let profile: GoogleProfile;
  try {
    profile = await verifyGoogleIdToken(tokenData.id_token, c.env.GOOGLE_CLIENT_ID, nonce);
  } catch {
    return c.redirect("/login?error=verify_failed");
  }

  const db = c.get("db");
  const userRes = await db.execute({
    sql: "SELECT id, email, display_name, image_url, is_admin FROM users WHERE google_id = ?",
    args: [profile.googleId],
  });
  let authUser: AuthUser;
  const user = userRes.rows[0];
  if (!user) {
    const userId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO users (id, email, display_name, image_url, google_id) VALUES (?, ?, ?, ?, ?)",
      args: [userId, profile.email, profile.displayName, profile.imageUrl, profile.googleId],
    });
    authUser = {
      id: userId,
      email: profile.email,
      displayName: profile.displayName,
      imageUrl: profile.imageUrl,
      isAdmin: false,
    };
  } else {
    authUser = {
      id: String(user.id),
      email: String(user.email),
      displayName: String(user.display_name),
      imageUrl: user.image_url ? String(user.image_url) : null,
      isAdmin: Boolean(Number(user.is_admin)),
    };
  }

  const sessionToken = await createSessionToken(c.env.AUTH_SECRET, authUser);
  setCookie(c, "__Host-session", sessionToken, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 86400, path: "/" });
  return c.redirect("/");
});

app.post("/api/auth/logout", (c) => {
  deleteCookie(c, "__Host-session", { path: "/" });
  return c.redirect("/");
});
// 画面ルート
app.get("/", async (c) => {
  const db = c.get("db");
  const scenarios = await getScenarios(db);
  const recentRuns = await getRecentRuns(db, 5);
  return c.html(
    <Layout user={c.get("user")} activeNav="scenarios">
      <ScenarioListView scenarios={scenarios} recentRuns={recentRuns} />
    </Layout>
  );
});

app.get("/scenarios/new", (c) => {
  return c.html(
    <Layout user={c.get("user")} activeNav="new" title="新規シナリオ作成">
      <ScenarioFormView />
    </Layout>
  );
});

app.get("/scenarios/:id/edit", async (c) => {
  const db = c.get("db");
  const scenario = await getScenario(db, c.req.param("id"));
  if (!scenario) return c.notFound();
  return c.html(
    <Layout user={c.get("user")} title={`シナリオ編集: ${scenario.title}`}>
      <ScenarioFormView scenario={scenario} isEdit={true} />
    </Layout>
  );
});

app.get("/scenarios/:id/run", async (c) => {
  const db = c.get("db");
  const scenario = await getScenario(db, c.req.param("id"));
  if (!scenario) return c.notFound();

  const seedQuery = c.req.query("seed");
  const seed = seedQuery ? Number(seedQuery) : Math.floor(Math.random() * 90000000) + 10000000;
  const isReplay = c.req.query("replay") === "1";

  return c.html(
    <Layout user={c.get("user")} title={`施行: ${scenario.title}`}>
      <SimulatorView scenario={scenario} seed={seed} isReplay={isReplay} />
    </Layout>
  );
});

app.get("/scenarios/:id", (c) => {
  return c.redirect(`/scenarios/${c.req.param("id")}/run`);
});

app.get("/runs", async (c) => {
  const db = c.get("db");
  const runs = await getRecentRuns(db, 50);
  return c.html(
    <Layout user={c.get("user")} activeNav="runs" title="施行履歴一覧">
      <RunsListView runs={runs} />
    </Layout>
  );
});

app.get("/runs/:id", async (c) => {
  const db = c.get("db");
  const runId = c.req.param("id");
  const run = await getRun(db, runId);
  if (!run) return c.notFound();
  const turnLogs = await getTurnLogs(db, runId);
  const eventLogs = await getEventLogs(db, runId);

  return c.html(
    <Layout user={c.get("user")} title={`レポート: #${run.id.slice(0, 8)}`}>
      <RunReportView run={run} turnLogs={turnLogs} eventLogs={eventLogs} />
    </Layout>
  );
});
// APIルート
function parseScenarioConfig(body: Record<string, any>): ScenarioConfig {
  return {
    agentCount: Number(body.agentCount) || 500,
    maxTurns: Number(body.maxTurns) || 200,
    initialWealth: Number(body.initialWealth) || 10000,
    wealthDistribution: body.wealthDistribution === "unequal" ? "unequal" : "equal",
    waitRate: Number(body.waitRate) || 0,
    investorRate: Number(body.investorRate) || 0,
    investorReturnRate: 5,
    investorFailRate: 4,
    learningAgent: body.learningAgent === "1" || body.learningAgent === "true",
    matchRule: body.matchRule === "community" ? "community" : "random",
    communityGroups: 4,
    strongAdvantage: body.strongAdvantage === "1" || body.strongAdvantage === "true",
    strongAdvantageTopPercent: 10,
    strongAdvantageBonus: 0.15,
    betRule: "min_wealth",
    betRatio: (Number(body.betRatio) || 10) / 100,
    ubiEnabled: Number(body.ubiAmount) > 0,
    ubiAmount: Number(body.ubiAmount) || 0,
    progressiveTaxEnabled: Number(body.progressiveTaxRate) > 0,
    progressiveTaxThreshold: (Number(body.initialWealth) || 10000) * 2,
    progressiveTaxRate: (Number(body.progressiveTaxRate) || 0) / 100,
    reliefEnabled: body.reliefEnabled === "1" || body.reliefEnabled === "true",
    reliefRate: 0.05,
    inflationRate: (Number(body.inflationRate) || 0) / 100,
    bankruptcyThreshold: Number(body.bankruptcyThreshold) || 100,
  };
}

app.post("/api/scenarios", async (c) => {
  const body = await c.req.parseBody();
  const title = String(body.title || "").trim();
  if (!title) return c.text("タイトルを入力してください", 400);
  const description = String(body.description || "").trim();
  const config = parseScenarioConfig(body);
  const id = "scen-" + crypto.randomUUID().slice(0, 8);

  const db = c.get("db");
  await createScenario(db, {
    id,
    user_id: c.get("user")?.id ?? null,
    title,
    description,
    config,
  });

  return c.redirect(`/scenarios/${id}/run`);
});

app.post("/api/scenarios/:id/update", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const title = String(body.title || "").trim();
  if (!title) return c.text("タイトルを入力してください", 400);
  const description = String(body.description || "").trim();
  const config = parseScenarioConfig(body);

  const db = c.get("db");
  await updateScenario(db, id, { title, description, config });
  return c.redirect(`/scenarios/${id}/run`);
});

app.post("/api/scenarios/:id/copy", async (c) => {
  const db = c.get("db");
  const original = await getScenario(db, c.req.param("id"));
  if (!original) return c.notFound();

  const newId = "scen-" + crypto.randomUUID().slice(0, 8);
  let config: ScenarioConfig = {} as ScenarioConfig;
  try {
    config = JSON.parse(original.config_json);
  } catch (e) {}

  await createScenario(db, {
    id: newId,
    user_id: c.get("user")?.id ?? null,
    title: `${original.title} (コピー)`,
    description: original.description,
    config,
  });

  return c.redirect(`/scenarios/${newId}/edit`);
});
app.post("/api/runs", async (c) => {
  const data = await c.req.json<{
    scenario_id: string;
    seed_value: number;
    status: string;
    max_turns: number;
    final_turn: number;
    summary: RunSummary;
    turn_logs: TurnLog[];
    event_logs: EventLog[];
  }>();

  const runId = crypto.randomUUID();
  const db = c.get("db");

  await db.execute({
    sql: `INSERT INTO simulation_runs (id, scenario_id, user_id, seed_value, status, max_turns, final_turn, summary_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      runId,
      data.scenario_id,
      c.get("user")?.id ?? null,
      data.seed_value,
      data.status || "completed",
      data.max_turns,
      data.final_turn,
      JSON.stringify(data.summary || {}),
    ],
  });

  if (data.turn_logs && Array.isArray(data.turn_logs)) {
    for (const log of data.turn_logs) {
      await db.execute({
        sql: `INSERT INTO turn_logs (run_id, turn, gini_index, survivor_count, mean_wealth, median_wealth, top_1_share, top_10_share, bottom_50_share, histogram_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          runId,
          log.turn,
          log.gini_index,
          log.survivor_count,
          log.mean_wealth,
          log.median_wealth,
          log.top_1_share,
          log.top_10_share,
          log.bottom_50_share,
          log.histogram_json || "[]",
        ],
      });
    }
  }

  if (data.event_logs && Array.isArray(data.event_logs)) {
    for (const evt of data.event_logs) {
      await db.execute({
        sql: `INSERT INTO event_logs (run_id, turn, event_type, message, event_detail_json, created_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [runId, evt.turn, evt.event_type, evt.message, evt.event_detail_json || null],
      });
    }
  }

  return c.json({ success: true, run_id: runId });
});

app.get("/api/runs/:id/export.csv", async (c) => {
  const db = c.get("db");
  const runId = c.req.param("id");
  const run = await getRun(db, runId);
  if (!run) return c.notFound();
  const logs = await getTurnLogs(db, runId);

  let csv = "Turn,GiniIndex,SurvivorCount,MeanWealth,MedianWealth,Top1Share,Top10Share,Bottom50Share\n";
  for (const log of logs) {
    csv += `${log.turn},${log.gini_index},${log.survivor_count},${log.mean_wealth},${log.median_wealth},${log.top_1_share},${log.top_10_share},${log.bottom_50_share}\n`;
  }

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="abwds_run_${runId.slice(0, 8)}.csv"`);
  return c.text(csv);
});

