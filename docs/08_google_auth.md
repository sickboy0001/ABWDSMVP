# Google ログイン機能 移行仕様書（AI 実装指示書）

## 1. 概要

ユーザーが Google アカウントを利用して、数秒で安全にログイン・新規登録できる機能を提供します。

### 1.1 目的
- 既存の Google OAuth 実装（NextAuth.js ベース）を、他のフレームワークやプラットフォームで再現する。
- Google ログインを任意で利用できるようにし、ログインしたユーザーが作成した ToDo の所有者を記録・表示する。
- ログインしなくても ToDo 一覧を閲覧できるようにする。

### 1.2 対象機能
- Google OAuth による任意ログイン（OAuth 2.0 / OIDC）
- 初回ログイン時の自動ユーザー登録
- セッション管理（HttpOnly Cookie による JWT）
- ユーザー情報（ID、名前、メール、画像）の取得と保存
- ToDo の所有者情報の保存と表示
- メールアドレス/パスワードによる認証は実装しない

---

## 2. 機能要件詳細

### 2.1 Google OAuth ログイン
ユーザーは Google アカウントを選択するだけで、パスワード入力なしでログインできます。

#### 2.1.1 動作フロー
0. **未ログインで利用**:
  - ログインを必須にせず、未ログインでも ToDo 一覧を閲覧できる。
  - 未ログインで作成した ToDo の所有者は `NULL` とする。
1. **Google でログイン（任意）**:
  - `/login` にメールアドレス/パスワード入力欄を表示するが、メール/パスワード認証は未実装とする。Google ログインのみ利用可能とする。
   - OAuth 2.0 認可リクエストが Google へ送信される。
2. **Google 認証画面**:
   - ユーザーは Google 側でログイン（またはアカウント選択）。
   - 権限付与画面で「メールアドレス」「プロフィール情報」へのアクセスを許可。
3. **コールバック処理**:
   - Google からリダイレクト URI へ戻り、認可コード（code）を受け取る。
   - サーバー側で認可コードを交換し、アクセストークン・ID トークンを取得。
4. **ユーザー処理**:
  - **新規ユーザー**: `users` テーブルに新規レコードを作成。
  - **既存ユーザー**: `google_id` を優先してユーザーを特定し、該当ユーザーのセッションを生成。
5. **セッション確立**:
  - アプリケーション用 JWT を HttpOnly Cookie に設定する。localStorage には保存しない。
  - ログイン後の遷移先（`callbackUrl`）へ遷移する。遷移先は同一オリジン内の相対パスだけ許可する。

Google ログインは任意であり、セッションがないことだけを理由に公開ページや ToDo の閲覧・操作を拒否してはならない。所有者のある ToDo は本人だけが更新・削除できる。所有者が `NULL` の ToDo は従来どおり誰でも更新・削除できる。

#### 2.1.2 取得するユーザー情報
Google OAuth から取得し、システム内で利用する情報：
| 項目 | 変数名 | 説明 |
|---|---|---|
| ユーザー ID | `sub` (OIDC) | Google 固有の一意な ID（永続的） |
| メールアドレス | `email` | 検証済みメールアドレス |
| 表示名 | `name` | Google プロフィール名 |
| 画像 URL | `picture` | プロフィール画像の URL |
| メール認証フラグ | `email_verified` | `true`（Google 認証済み） |

- tursoで保存する情報とする。

### 2.2 自動ユーザー登録（Just-in-Time Provisioning）
初回ログイン時に、自動的にユーザーアカウントを作成します。

#### 2.2.1 登録ロジック
1. **ユーザー存在確認**:
   - 取得した `email` または `sub`（Google ID）で `users` テーブルを検索。
2. **新規登録の場合**:
   - `id`: UUID または nanoid で一意な ID を生成。
   - `email`: Google から取得したメールアドレス。
   - `display_name`: Google から取得した名前（またはメールアドレスの@前）。
   - `email_verified`: `true`（Google 認証済みなので自動承認）。
   - `created_at`: 現在時刻。
3. **既存ユーザーの場合**:
   - 最新のログイン日時を更新（オプション）。
   - 表示名が変更されていた場合、更新する（オプション）。

### 2.3 セッション管理
ログイン状態を維持するためのセッション管理を実装します。

#### 2.3.1 JWT（JSON Web Token）
- **トークン構造**:
  - `payload`: `userId`, `email`, `name`, `isAdmin`, `iat`（発行時刻）, `exp`（有効期限）。
  - **署名**: シークレットキー（`AUTH_SECRET`）で HMAC または RS256 で署名。
- **有効期限**: 推奨 24 時間（リフレッシュトークン方式も可）。
- **保存先**: HttpOnly Cookie のみ。localStorage や JavaScript から読める Cookie には保存しない。
- **Cookie 属性**: `HttpOnly; Secure; SameSite=Lax; Path=/` を設定する。Cookie 名は `__Host-session` を推奨する。
- **有効期限**: 24 時間。

#### 2.3.2 セッション検証
- 各リクエストで Cookie 内の JWT を検証。
- 有効な場合：`userId` を基にユーザー情報を取得し、リクエストに付与。
- 無効/期限切れの場合：セッションなしとして扱う。ログイン必須ではないため、公開ページ/APIを一律に 401 にしてはならない。

### 2.4 ログアウト機能
- **処理**: セッショントークン Cookie を同じ属性で期限切れにする。JWT のサーバー側失効（セッションテーブル等）は初期実装では行わない。
- **UI**: ログイン中のみヘッダー等に「ログアウト」ボタンを表示する。
- **エンドポイント**: `POST /api/auth/logout` に統一する。

---

## 3. データベース設計

### 3.1 `users` テーブル（認証用）
Google ログイン機能に必要な最小限のカラム定義。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ユーザー一意 ID（UUID/nanoid） |
| `email` | TEXT | UNIQUE, NOT NULL | Google から取得したメールアドレス |
| `display_name` | TEXT | | 表示名（Google 名または自動生成） |
| `image_url` | TEXT | | プロフィール画像 URL（Google 提供） |
| `google_id` | TEXT | UNIQUE | Google 固有 ID（`sub` クレーム）※推奨 |
| `email_verified` | BOOLEAN | DEFAULT true | メール認証フラグ（Google なら true） |
| `is_admin` | BOOLEAN | DEFAULT false | 管理者フラグ |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新日時 |

**注**: `google_id` カラムは、メールアドレス変更時のユーザー同定に有用です。必須ではありませんが、実装を推奨します。

- tursoで保存する情報とする。

### 3.2 `todos` テーブルの所有者

既存の `todos` テーブルに、`users.id` を参照する nullable な `owner_user_id` を追加する。ログイン中のユーザーが作成した ToDo にはそのユーザー ID を設定し、未ログインで作成した ToDo は `NULL` とする。既存データは所有者を特定できないため `NULL` のまま維持する。

```sql
ALTER TABLE todos ADD COLUMN owner_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_todos_owner_user_id ON todos(owner_user_id);
```

一覧では `owner_user_id` がある ToDo に限り `users` を JOIN し、所有者の `display_name` と `image_url` を表示する。所有者がない場合は所有者表示を出さない。メールアドレスは ToDo 一覧には表示しない。

所有者が設定された ToDo は本人だけが更新・削除できる。未ログインユーザーは所有者付き ToDo の更新・削除ができない。所有者が `NULL` の ToDo は公開データとして、従来どおり誰でも操作できる。所有者表示（表示名・画像）は ToDo 一覧を閲覧できる全員に公開される。

---

## 4. 実装手順（AI 向けチェックリスト）

### 4.1 事前準備：Google Cloud Console
1. **プロジェクト作成**: Google Cloud Console で新規プロジェクトを作成。
2. **OAuth 同意画面**: Google Auth Platform でアプリ情報と対象ユーザーを設定する。テスト中はテストユーザーを登録する。Google+ API の有効化は不要。
3. **認証情報作成**:
   - **OAuth クライアント ID**:
     - アプリケーションの種類は「ウェブ アプリケーション」。
     - 承認済みの JavaScript 生成元は設定しない（このアプリはサーバー側でOAuthを処理する）。
     - 承認済みのリダイレクト URIには、ローカルの `http://localhost:8787/api/auth/callback/google` と、本番Workerの `https://<本番Workerのホスト名>/api/auth/callback/google` を登録する。
   - **取得する値**:
     - `CLIENT_ID`（Google OAuth Client ID）
     - `CLIENT_SECRET`（Google OAuth Client Secret）

### 4.2 環境変数の設定
移行先システムで以下の環境変数を設定してください。

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# セッションシークレット（32 文字以上のランダム文字列）
AUTH_SECRET=your_random_secret_here

# アプリケーションのオリジン（末尾の / なし。OAuth コールバック URL の生成に使用）
APP_BASE_URL=https://your-worker-domain.example
```

### 4.2.1 コールバック URL の設定

コールバックパスは `/api/auth/callback/google` とし、Google Cloud Console の OAuth クライアントに、実際に使用する各環境の URL を個別に登録する。ワイルドカードは使用できない。

| 環境 | 登録例 |
|---|---|
| Wrangler ローカル開発 | `http://localhost:8787/api/auth/callback/google` |
| 本番 Worker | `https://<本番Workerのホスト名>/api/auth/callback/google` |
| Preview Worker | `https://<Preview Workerのホスト名>/api/auth/callback/google` |

本番と Preview でホスト名が異なる場合はそれぞれ登録する。Preview の一時 URL を固定できない場合は、本番用 OAuth クライアントを Preview で共有せず、Preview 用の固定ホスト名または別 OAuth クライアントを用意する。Cloudflare Workers の Variables and Secrets には `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`AUTH_SECRET`、`APP_BASE_URL` を設定し、秘密値は Secret として登録する。ローカルでは `.dev.vars` に設定し、Git にコミットしない。

### 4.3 実装ステップ
1. **OAuth 実装方式**:
  - このプロジェクトは Hono + Cloudflare Workers のため、NextAuth.js の Next.js 用ハンドラーは使用しない。Workers 互換の OAuth ライブラリ、または標準 Fetch API を使った Hono ハンドラーで実装する。
 
2. **OAuth 設定**:
  - `APP_BASE_URL` からコールバック URI を組み立て、Google Cloud Console に登録した URI と完全一致させる。
  - 認可スコープは `openid email profile` とする。
3. **ユーザーモデルの作成**:
   - `users` テーブル（または同等の ORM モデル）を作成。
4. **ログインボタンの実装**:
   - 「Google でログイン」ボタンを作成。
   - クリックで OAuth 認可 URL へリダイレクト。
5. **コールバックハンドラの実装**:
   - Google からのリダイレクトを受け取り、トークンを交換。
  - ユーザーの作成/取得ロジックを実装する。メール一致だけで既存アカウントへ自動連携しない。
  - セッション（JWT）を HttpOnly Cookie に設定する。
6. **セッション検証ミドルウェア**:
  - Cookie がある場合に検証し、有効ならユーザー情報をリクエストに付与する。セッションなしでも公開機能の利用を許可する。
7. **ログアウト機能の実装**:
   - セッション削除エンドポイントを作成。

---

## 5. API エンドポイント設計（参考）

### 5.1 ログイン開始
- **URL**: `GET /api/auth/login/google`
- **動作**: Google OAuth 認可 URL へリダイレクト。
- **クエリパラメータ**:
  - `callbackUrl`: ログイン後の遷移先（例：`/dashboard`）。

### 5.2 コールバック処理
- **URL**: `GET /api/auth/callback/google`
- **パラメータ**:
  - `code`: Google から返された認可コード。
  - `state`: CSRF 対策用トークン。
- **動作**:
  1. `code` をアクセストークンに交換。
  2. ユーザー情報を取得。
  3. ユーザーの作成/取得。
  4. セッションを生成し、リダイレクト。

### 5.3 セッション取得
- **URL**: `GET /api/auth/session`
- **レスポンス**:
  ```json
  {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "image": "https://lh3.googleusercontent.com/...",
      "isAdmin": false
    }
  }
  ```
  未ログイン時は `{"user":null}` を返す。

### 5.4 ログアウト
- **URL**: `POST /api/auth/logout`
- **動作**: セッションを破棄し、ログイン画面へリダイレクト。

---

## 6. セキュリティ要件

### 6.1 CSRF 対策
- OAuth フローで暗号学的にランダムな `state` と OIDC `nonce` を発行・検証する。対応ライブラリが利用できる場合は PKCE も有効にする。
- ID トークンの署名、`iss`、`aud`、`exp`、`nonce` を検証し、`email_verified` が true の場合のみ登録する。
- セッションクッキーには `SameSite=Lax` を設定する。状態変更を行うアプリケーションの POST API でも CSRF 対策を行う。

### 6.2 XSS 対策
- セッショントークンは `HttpOnly` クッキーで保存（JavaScript からのアクセスを防止）。
- ユーザー入力（表示名など）は出力時にエスケープ。

### 6.3 認可チェック
- 管理者機能など、権限が必要なエンドポイントでは `is_admin` を検証。
- ToDo の閲覧と所有者 `NULL` の ToDo の操作はログイン不要。所有者付き ToDo の更新・削除は本人に限定する。

### 6.4 トークン管理
- JWT の有効期限を適切に設定（例：24 時間）。
- リフレッシュトークン方式を採用する場合、リフレッシュトークンは安全に保存（HttpOnly クッキー）。

---

## 7. UI/UX 要件

### 7.1 ログイン画面
- ヘッダーの「ログイン」から `/login` を表示する。
- メールアドレスとパスワードの入力欄を表示するが、メール/パスワード認証は未実装とし、ボタンを無効にする。
- **Google ログインボタン**:
  - `/login` 画面に配置し、Google OAuth のみ実際に利用できる。
  - Google 公式のボタンデザインまたは類似スタイルを使用。
  - アイコン（Google G ロゴ）を左側に配置。
- **メール/パスワード認証**: 実装しない。

### 7.2 エラーハンドリング
- **認証失敗**: 「ログインに失敗しました。もう一度お試しください。」
- **アカウント存在**: 「このアカウントは既に登録されています。」
- **ネットワークエラー**: 「一時的なエラーが発生しました。」

### 7.3 ロード状態
- ボタンクリック時に「ログイン中...」等のインジケーターを表示。

---

## 8. 移行時の注意点

1. **Google ID の永続性**:
   - メールアドレスは変更される可能性があります。ユーザー同定には `google_id`（`sub`）を使用することを強く推奨します。
2. **メール認証**:
   - Google OAuth ではメールが既に検証済みであるため、`email_verified = true` で登録してください。
3. **プロフィール画像**:
   - Google 提供の画像 URL は一時的な場合があるため、必要に応じて自サーバーでキャッシュするか、代替画像を用意してください。
4. **プライバシーポリシー**:
   - Google の OAuth 利用には、プライバシーポリシーと利用規約の表示が義務付けられています。

---

## 9. 参考：既存実装のコード断片（Next.js + NextAuth）

### 9.1 認証設定（`auth.ts`）
```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // 自動ユーザー登録ロジック
      // 1. users テーブルで email 検索
      // 2. 存在しなければ INSERT
      // 3. user.id に DB の ID を設定
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
});
```

### 9.2 ログインボタン（Client Component）
```typescript
import { signIn } from "next-auth/react";

<button
  onClick={() => signIn("google", { callbackUrl: "/" })}
  className="w-full flex items-center justify-center bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50"
>
  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-2" />
  Google でログイン
</button>
```

---

## 10. 環境変数一覧

| 変数名 | 説明 | 例 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | `123456789-abc...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | `GOCSPX-abc123...` |
| `AUTH_SECRET` | JWT シークレット（32 文字以上） | `random_string_of_at_least_32_characters` |
| `APP_BASE_URL` | OAuth コールバック URI を生成するアプリケーションのオリジン | `https://example.com` |
