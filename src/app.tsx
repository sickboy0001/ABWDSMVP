import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createClient, type Client, type Row } from "@libsql/client/web";
import {
  createPkceChallenge,
  createSessionToken,
  randomToken,
  verifyGoogleIdToken,
  verifySessionToken,
  type AuthUser,
  type GoogleProfile,
} from "./auth";

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string;
  APP_BASE_URL: string;
};

type Todo = {
  id: string;
  title: string;
  completed: number;
  created_at: string;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_image_url: string | null;
};

type Filter = "all" | "active" | "completed";

export const app = new Hono<{
  Bindings: Bindings;
  Variables: { db: Client; user: AuthUser | null };
}>();

function mapTodo(row: Row): Todo {
  return {
    id: String(row.id),
    title: String(row.title),
    completed: Number(row.completed),
    created_at: String(row.created_at),
    owner_user_id:
      row.owner_user_id === null || row.owner_user_id === undefined
        ? null
        : String(row.owner_user_id),
    owner_name:
      row.owner_name === null || row.owner_name === undefined
        ? null
        : String(row.owner_name),
    owner_image_url:
      row.owner_image_url === null || row.owner_image_url === undefined
        ? null
        : String(row.owner_image_url),
  };
}

async function getTodos(db: Client, filter: Filter): Promise<Todo[]> {
  const condition =
    filter === "active"
      ? "WHERE t.completed = 0"
      : filter === "completed"
        ? "WHERE t.completed = 1"
        : "";
  const result = await db.execute(
    `SELECT t.id, t.title, t.completed, t.created_at, t.owner_user_id, u.display_name AS owner_name, u.image_url AS owner_image_url FROM todos t LEFT JOIN users u ON u.id = t.owner_user_id ${condition} ORDER BY t.created_at DESC, t.rowid DESC`,
  );
  return result.rows.map(mapTodo);
}

async function getTodo(db: Client, id: string): Promise<Todo | null> {
  const result = await db.execute({
    sql: `SELECT t.id, t.title, t.completed, t.created_at, t.owner_user_id, u.display_name AS owner_name, u.image_url AS owner_image_url FROM todos t LEFT JOIN users u ON u.id = t.owner_user_id WHERE t.id = ?`,
    args: [id],
  });
  return result.rows[0] ? mapTodo(result.rows[0]) : null;
}

function canManageTodo(todo: Todo, user: AuthUser | null): boolean {
  return todo.owner_user_id === null || todo.owner_user_id === user?.id;
}

function parseFilter(value: string | undefined): Filter {
  if (value === "active" || value === "completed") return value;
  return "all";
}

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
              imageUrl:
                row.image_url === null || row.image_url === undefined
                  ? null
                  : String(row.image_url),
              isAdmin: Number(row.is_admin) === 1,
            };
          }
        }
      } catch {
        user = null;
      }
    }
    c.set("user", user);
    await next();
  } finally {
    await db.close();
  }
});

const oauthCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  path: "/",
};

function clearOAuthCookies(c: Parameters<typeof deleteCookie>[0]) {
  for (const name of [
    "__Host-oauth-state",
    "__Host-oauth-nonce",
    "__Host-oauth-verifier",
    "__Host-oauth-return",
  ]) {
    deleteCookie(c, name, oauthCookieOptions);
  }
}

function safeReturnPath(value: string | undefined, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const target = new URL(value, origin);
    return target.origin === origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/";
  } catch {
    return "/";
  }
}

function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

app.get("/api/auth/login/google", async (c) => {
  const { GOOGLE_CLIENT_ID, AUTH_SECRET, APP_BASE_URL } = c.env;
  if (
    !GOOGLE_CLIENT_ID ||
    !AUTH_SECRET ||
    AUTH_SECRET.length < 32 ||
    !APP_BASE_URL
  )
    return c.text("Google OAuth is not configured.", 503);

  const baseUrl = new URL(APP_BASE_URL);
  const redirectUri = new URL("/api/auth/callback/google", baseUrl).toString();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await createPkceChallenge(verifier);
  const returnPath = safeReturnPath(c.req.query("callbackUrl"), baseUrl.origin);

  for (const [name, value] of [
    ["__Host-oauth-state", state],
    ["__Host-oauth-nonce", nonce],
    ["__Host-oauth-verifier", verifier],
    ["__Host-oauth-return", returnPath],
  ]) {
    setCookie(c, name, value, { ...oauthCookieOptions, maxAge: 600 });
  }

  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return c.redirect(authorizationUrl.toString(), 302);
});

app.get("/api/auth/callback/google", async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, APP_BASE_URL } =
    c.env;
  const state = getCookie(c, "__Host-oauth-state");
  const nonce = getCookie(c, "__Host-oauth-nonce");
  const verifier = getCookie(c, "__Host-oauth-verifier");
  const returnPath = safeReturnPath(
    getCookie(c, "__Host-oauth-return"),
    APP_BASE_URL || new URL(c.req.url).origin,
  );
  const code = c.req.query("code");

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !AUTH_SECRET ||
    AUTH_SECRET.length < 32 ||
    !APP_BASE_URL
  ) {
    clearOAuthCookies(c);
    return c.text("Google OAuth is not configured.", 503);
  }

  if (
    c.req.query("error") ||
    !code ||
    !state ||
    state !== c.req.query("state") ||
    !nonce ||
    !verifier
  ) {
    clearOAuthCookies(c);
    return c.redirect("/login?auth=failed", 303);
  }

  try {
    const redirectUri = new URL(
      "/api/auth/callback/google",
      APP_BASE_URL,
    ).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) throw new Error("Google ID token is missing");

    const profile = await verifyGoogleIdToken(
      tokens.id_token,
      GOOGLE_CLIENT_ID,
      nonce,
    );
    const db = c.get("db");
    await db.execute({
      sql: `INSERT INTO users (id, email, display_name, image_url, google_id, email_verified)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(google_id) DO UPDATE SET
              email = excluded.email,
              display_name = excluded.display_name,
              image_url = excluded.image_url,
              email_verified = 1,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        crypto.randomUUID(),
        profile.email,
        profile.displayName,
        profile.imageUrl,
        profile.googleId,
      ],
    });
    const userResult = await db.execute({
      sql: "SELECT id, email, display_name, image_url, is_admin FROM users WHERE google_id = ?",
      args: [profile.googleId],
    });
    const row = userResult.rows[0];
    if (!row) throw new Error("User could not be loaded");

    const user: AuthUser = {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      imageUrl:
        row.image_url === null || row.image_url === undefined
          ? null
          : String(row.image_url),
      isAdmin: Number(row.is_admin) === 1,
    };
    const session = await createSessionToken(AUTH_SECRET, user);
    clearOAuthCookies(c);
    setCookie(c, "__Host-session", session, {
      ...oauthCookieOptions,
      maxAge: 60 * 60 * 24,
    });
    return c.redirect(returnPath, 303);
  } catch {
    clearOAuthCookies(c);
    return c.redirect("/login?auth=failed", 303);
  }
});

app.get("/api/auth/session", (c) => {
  const user = c.get("user");
  return c.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.imageUrl,
          isAdmin: user.isAdmin,
        }
      : null,
  });
});

app.post("/api/auth/logout", (c) => {
  if (!sameOriginRequest(c.req.raw)) return c.text("Forbidden", 403);
  deleteCookie(c, "__Host-session", oauthCookieOptions);
  return c.redirect("/", 303);
});

function Layout({
  children,
  user,
  authFailed = false,
  loginPage = false,
}: {
  children: any;
  user: AuthUser | null;
  authFailed?: boolean;
  loginPage?: boolean;
}) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f4f5f0" />
        <title>ToDo | Daily Ledger</title>
        <link rel="stylesheet" href="/style.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      </head>
      <body>
        <div class="page-shell">
          <header class="topbar">
            <a class="wordmark" href="/" aria-label="Daily Ledger ホーム">
              <span class="mark" aria-hidden="true">
                D
              </span>
              <span>daily ledger</span>
            </a>
            <div class="account-area">
              {user ? (
                <>
                  <span class="account-user">
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt=""
                        referrerpolicy="no-referrer"
                      />
                    ) : (
                      <span class="account-avatar-fallback">
                        {user.displayName.slice(0, 1)}
                      </span>
                    )}
                    <span>{user.displayName}</span>
                  </span>
                  <form method="post" action="/api/auth/logout">
                    <button class="account-action" type="submit">
                      ログアウト
                    </button>
                  </form>
                </>
              ) : !loginPage ? (
                <a class="google-login" href="/login">
                  ログイン
                </a>
              ) : null}
            </div>
          </header>
          <main>
            {authFailed && (
              <p class="auth-error" role="alert">
                ログインに失敗しました。設定を確認して、もう一度お試しください。
              </p>
            )}
            {children}
          </main>
          <footer class="footer">
            <span>ひとつずつ、片づける。テスト</span>
            <span>DAILY LEDGER · TO-DO</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

function TodoItem({ todo, user }: { todo: Todo; user: AuthUser | null }) {
  const completed = Boolean(todo.completed);
  const canManage = canManageTodo(todo, user);
  return (
    <li
      class={`todo-item${completed ? " is-complete" : ""}`}
      id={`todo-${todo.id}`}
    >
      {canManage && (
        <label class="todo-check">
          <input
            type="checkbox"
            checked={completed}
            aria-label={`${todo.title}を${completed ? "未完了に戻す" : "完了にする"}`}
            hx-patch={`/todos/${todo.id}/toggle`}
            hx-target="closest li"
            hx-swap="outerHTML"
          />
          <span class="checkmark" aria-hidden="true"></span>
        </label>
      )}
      <span class="todo-title">{todo.title}</span>
      {todo.owner_user_id && todo.owner_name && (
        <span class="todo-owner" title={`所有者: ${todo.owner_name}`}>
          {todo.owner_image_url ? (
            <img
              src={todo.owner_image_url}
              alt=""
              referrerpolicy="no-referrer"
            />
          ) : (
            <span class="owner-avatar-fallback">
              {todo.owner_name.slice(0, 1)}
            </span>
          )}
          <span>{todo.owner_name}</span>
        </span>
      )}
      {canManage && (
        <button
          class="delete-button"
          type="button"
          aria-label={`${todo.title}を削除`}
          hx-delete={`/todos/${todo.id}`}
          hx-target="closest li"
          hx-swap="outerHTML"
          hx-confirm="このタスクを削除しますか？"
        >
          削除
        </button>
      )}
    </li>
  );
}

function TodoCollection({
  todos,
  filter,
  user,
}: {
  todos: Todo[];
  filter: Filter;
  user: AuthUser | null;
}) {
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "active", label: "未完了" },
    { key: "completed", label: "完了済み" },
  ];

  return (
    <section class="todo-content" id="todo-content" aria-live="polite">
      <nav class="filters" aria-label="タスクの絞り込み">
        {filters.map(({ key, label }) => (
          <button
            type="button"
            class={`filter-button${filter === key ? " is-current" : ""}`}
            aria-pressed={filter === key}
            hx-get={`/todos?filter=${key}`}
            hx-target="#todo-content"
            hx-swap="outerHTML"
          >
            {label}
          </button>
        ))}
      </nav>
      <ul
        class="todo-list"
        id="todo-list"
        data-empty="ここはすっきり。タスクを追加しましょう。"
      >
        {todos.map((todo) => (
          <TodoItem todo={todo} user={user} />
        ))}
      </ul>
    </section>
  );
}

app.get("/login", (c) => {
  if (c.get("user")) return c.redirect("/", 302);
  return c.html(
    <Layout user={null} authFailed={c.req.query("auth") === "failed"} loginPage>
      <section class="login-page">
        <div class="login-intro">
          <p class="eyebrow">DAILY LEDGER / ACCOUNT</p>
          <h1>ログイン</h1>
        </div>
        <section class="login-panel" aria-label="ログイン">
          <div class="login-fields">
            <label for="login-email">メールアドレス</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="name@example.com"
            />
            <label for="login-password">パスワード</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="パスワード"
            />
            <button class="email-login-submit" type="button" disabled>
              メールアドレスでログイン
            </button>
          </div>
          <div class="login-divider">
            <span>または</span>
          </div>
          <a
            class="google-login google-login-primary"
            href="/api/auth/login/google?callbackUrl=%2F"
          >
            <span class="google-g" aria-hidden="true">
              G
            </span>
            Googleでログイン
          </a>
        </section>
        <a class="login-back" href="/">
          ToDoに戻る
        </a>
      </section>
    </Layout>,
  );
});

app.get("/", async (c) => {
  const todos = await getTodos(c.get("db"), "all");
  return c.html(
    <Layout user={c.get("user")} authFailed={c.req.query("auth") === "failed"}>
      <section class="intro">
        <p class="eyebrow">DAILY LEDGER / TODAY</p>
        <h1>今日のタスク テスト０４２６</h1>
      </section>
      <section class="task-board" aria-label="ToDoリスト">
        <form
          class="todo-form"
          hx-post="/todos"
          hx-target="#todo-list"
          hx-swap="beforeend"
          hx-on--after-request="if (event.detail.successful) this.reset()"
        >
          <label class="visually-hidden" for="todo-title">
            新しいタスク
          </label>
          <input
            id="todo-title"
            name="title"
            type="text"
            maxlength={160}
            placeholder="次にやることは？"
            autocomplete="off"
            required
          />
          <button class="add-button" type="submit">
            <span aria-hidden="true">+</span> 追加
          </button>
        </form>
        <TodoCollection todos={todos} filter="all" user={c.get("user")} />
      </section>
    </Layout>,
  );
});

app.get("/todos", async (c) => {
  const filter = parseFilter(c.req.query("filter"));
  const todos = await getTodos(c.get("db"), filter);
  return c.html(
    <TodoCollection todos={todos} filter={filter} user={c.get("user")} />,
  );
});

app.post("/todos", async (c) => {
  const form = await c.req.parseBody();
  const title = typeof form.title === "string" ? form.title.trim() : "";
  if (!title || title.length > 160)
    return c.body("入力内容を確認してください。", 400);

  const id = crypto.randomUUID();
  const db = c.get("db");
  if (!sameOriginRequest(c.req.raw)) return c.text("Forbidden", 403);
  await db.execute({
    sql: "INSERT INTO todos (id, title, owner_user_id) VALUES (?, ?, ?)",
    args: [id, title, c.get("user")?.id ?? null],
  });
  const todo = await getTodo(db, id);
  if (!todo) return c.body("タスクを作成できませんでした。", 500);
  return c.html(<TodoItem todo={todo} user={c.get("user")} />);
});

app.patch("/todos/:id/toggle", async (c) => {
  if (!sameOriginRequest(c.req.raw)) return c.text("Forbidden", 403);
  const { id } = c.req.param();
  const db = c.get("db");
  const current = await getTodo(db, id);
  if (!current) return c.notFound();
  const user = c.get("user");
  if (!canManageTodo(current, user)) return c.text("Forbidden", 403);
  await db.execute({
    sql: "UPDATE todos SET completed = 1 - completed WHERE id = ?",
    args: [id],
  });
  const todo = await getTodo(db, id);
  if (!todo) return c.notFound();
  return c.html(<TodoItem todo={todo} user={user} />);
});

app.delete("/todos/:id", async (c) => {
  if (!sameOriginRequest(c.req.raw)) return c.text("Forbidden", 403);
  const db = c.get("db");
  const todo = await getTodo(db, c.req.param("id"));
  if (!todo) return c.notFound();
  if (!canManageTodo(todo, c.get("user"))) return c.text("Forbidden", 403);
  await db.execute({
    sql: "DELETE FROM todos WHERE id = ?",
    args: [c.req.param("id")],
  });
  return c.body(null, 200);
});
