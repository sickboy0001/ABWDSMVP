import type { Child } from "hono/jsx";
import type { AuthUser } from "../auth";

export function Layout(props: {
  title?: string;
  user: AuthUser | null;
  activeNav?: "scenarios" | "new" | "runs" | "login";
  children: Child;
}) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title ? `${props.title} - ABWDS` : "ABWDS - 富の動態シミュレーター"}</title>
        <link rel="stylesheet" href="/style.css" />
        <script src="/js/engine.js" type="module"></script>
        <script src="/js/simulator-ui.js"></script>
      </head>
      <body>
        <div class="page-container">
          <header class="app-header">
            <a href="/" class="brand-logo">
              <span class="brand-badge">ABWDS</span>
              <span>富の動態シミュレーター</span>
            </a>
            <nav class="nav-links">
              <a href="/" class={`nav-link ${props.activeNav === "scenarios" ? "active" : ""}`}>
                シナリオ一覧
              </a>
              <a href="/scenarios/new" class={`nav-link ${props.activeNav === "new" ? "active" : ""}`}>
                ＋ 新規作成
              </a>
              <a href="/runs" class={`nav-link ${props.activeNav === "runs" ? "active" : ""}`}>
                施行履歴
              </a>
              {props.user ? (
                <div class="user-profile">
                  {props.user.imageUrl && (
                    <img src={props.user.imageUrl} alt={props.user.displayName} class="user-avatar" />
                  )}
                  <span style="font-size: 0.85rem; color: var(--text-main); font-weight: 500;">{props.user.displayName}</span>
                  <form method="post" action="/api/auth/logout" style="margin: 0;">
                    <button type="submit" class="btn btn-secondary btn-sm">ログアウト</button>
                  </form>
                </div>
              ) : (
                <a href="/login" class="btn btn-secondary btn-sm">
                  Googleログイン
                </a>
              )}
            </nav>
          </header>
          <main>{props.children}</main>
        </div>
      </body>
    </html>
  );
}
