# 非機能要件


## 技術セット

|name| host | lang | serverside | frontend | database| comment |
|----| ---- | ---- | - | - | - | - |
|rust+topcoat+htmx| netlify | rust | topcoat | htmx | turso |- |
|hono+htmx| cloudflare | typescript | hono | jsx/htmx | turso/supabase/d3 |- |
|nextjs | netlify/vercel | typescript | nextjs | jsx | turso/supabase |実績あり |

②Hono＋Htmx（＋Turso＋CloudFlare）

Vercelは商用サイトだと無償では利用できない。
CloudFlareは商用サイトでも利用可能
Tursoはロックオンされず、様々なサイトからも利用可能
Supabaseはデータベース数などに制限ある
無償だとNetlifyはデプロイ数に制限あり、無償だと２０回程度

「Cloudflare Pages」での実装想定



### 各構成の詳細分析

#### 1. Hono + HTMX（Cloudflare）ー＞◎

**「爆速な開発スピード・低コスト・シンプルな保守性」を求めるなら最高の選択肢**

* **将来性：** 非常に高いです。HonoはTypeScriptエコシステムにおいてエッジファーストなWebフレームワークのデファクトになりつつあり、CloudflareやDenoも強力にバックアップしています。HTMXとの組み合わせは「複雑になりすぎたフロントエンド（SPA）への反動」として世界中で急速に採用が進んでいます。
* **メリット：**
* クライアントへ送信するJSが激減するため、表示速度（FCP）が爆速。
* `hono/jsx` を使うことで、Reactに似たJSXの書き心地で型安全にサーバーサイドHTMLを構築可能。
* Cloudflare Workersで動かすことで、インフラコストを劇的に抑えられる（無料枠も強力）。


* **懸念点：** Figmaのような「ブラウザ上で高度な状態管理や複雑なアニメーションを行うUI」には不向き。
  * 部分部分でREACTを利用することでカバーする。

#### 2. Next.js（Vercel / Netlify）ー＞△

**「業界標準・実績・将来のスケール（チーム開発/リッチUI）」を最重視するなら最も安全**

* **将来性：** 圧倒的です。すでにWeb開発のデファクトスタンダードであり、情報量、ライブラリ、採用（求人）市場のすべてで頭一つ抜けています。
* **メリット：**
* 実績があり、エコシステム（shadcn/ui、Auth.js、Prisma等）が完全に成熟している。
* App Router（Server Components）により、HTMXのようにサーバー主導のデータ取得を行いつつ、必要な部分だけReactのインタラクティブUIを組み込むハイブリッド構成が可能。


* **懸念点：** フレームワーク自体が巨大化・複雑化しており、Hono+HTMXに比べると学習コストや初期構築のオーバーヘッドが大きい。

#### 3. Rust + Topcoat + HTMX（Netlify）ー＞×

**将来性を見越した本番採用としてはリスクが高く、見送り推奨**

* **将来性：** 極めて不透明です。Topcoatなどの新興Rustフレームワークは魅力的な概念ですが、コミュニティが小さく、数年後にメンテナンスが滞るリスクがあります。
* **懸念点：**
* TopcoatはTokio（Linuxコンテナなど）での動作を基本想定しているため、Netlifyのサーバーレス関数（AWS Lambdaベース）環境ではコールドスタートが遅くなりがちです。
* 開発コストとトラブルシューティングに割かれる時間が大きくなります。


## デプロイ

- hono+htmxが有効


## CLCI

- GitHubへのアップで、自動でCloudFlareWokerにデプロイされる形を想定


ログイン機能は最低限にする
