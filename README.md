# 目的

社内で利用するWebアプリを、可能な限り低コストかつ過度な運用負荷を避けつつ構築するために、**Azure Static Web Apps（SWA）**をフロントエンド基盤として採用し、**GitHubのカスタム認証**で「特定のGitHub Organizationメンバーのみ利用可能」なアクセス制御を行う。データ永続化には**Azure SQL Database**を利用し、アプリケーションから安全に接続する。

本書は、実装詳細には踏み込まず、まず**必要なリソースを準備する段階まで**を整理する。

---

# 背景

* 利用可能なリソース

  * GitHub Enterprise Cloud 上の Private リポジトリ／Private GitHub Pages
  * インターネット回線上の Azure Subscription
  * 専用線回線上の Azure Subscription
* 制約

  * 社内 Entra ID の管理権限がなく、Entra ID を用いたアプリ登録（OAuth/OpenID Connectの登録運用）に依存しにくい
* 要望

  * 完全公開は避けたい（扱うデータは機密ではないが、積極的に公開したくない）
  * 可能な限り安い
  * 可能ならRDB（SQL DatabaseのFreeなど）を利用したい
* 設計上の前提

  * 「社内からだけ」をネットワーク閉域ではなく、**ID境界（GitHub Organization所属）**で代替する
  * SWA のステージング環境は不要（Callback URL を固定しやすくする）

---

# 非目標

* 「社内ネットワーク（専用線）からのみ到達可能」を厳密に満たすこと（Private Endpoint 等の閉域化は対象外）
* 実装（本格的な業務ロジック、詳細なAPI設計、スキーマ設計）
* 運用監視や詳細なログ設計（ただし最小の疎通確認に必要なログ確認は行う）

---

# 実施前提（確定事項）

* アクセス境界は **GitHub Organization メンバー**で定義する（ネットワーク閉域ではなくID境界）
* SWA は **ステージング環境なし**で運用し、本番URLを初期構築時に確定する
* 認証・認可は **GitHub App 1つ**に統合する

  * ログイン: GitHub App の OAuth フロー（Client ID / Client Secret）
  * Orgメンバー判定: 同一 GitHub App の installation access token（JWT→installation token）で GitHub API を参照
* 秘密情報は **Azure Key Vault を必須**とし、Functions は **system-assigned Managed Identity**で参照する
* データストアは Azure SQL Database（Free offer を優先）とし、接続は **API（Functions）経由のみ**

---

# 方式の概要

## 採用方針

* フロントエンド

  * Azure Static Web Apps（SWA Standard）
* 認証

  * SWA のカスタム認証として GitHub を登録（単一の GitHub App を使用）
* 認可

  * SWA の rolesSource（GetRoles）でサインイン時に「特定Organizationのメンバーか」を判定し、ロール付与で全体アクセス制御
  * 判定には同一 GitHub App の installation access token を用いる
* API / サーバー処理

  * ユーザー提供の Azure Functions（別 Function App）
  * system-assigned Managed Identity を有効化し、Key Vault から秘密情報を取得
* データ

  * Azure SQL Database（Free offer を優先候補）
  * DB接続は API（Functions）経由のみ。静的コンテンツに秘密情報を含めない
  * 秘密情報（SQL 接続情報、GitHub App の秘密鍵等）は Azure Key Vault に集約する

## 境界

* ブラウザには秘密情報を保持しない
* 認可判定はサーバ側（rolesSource）で行い、静的ファイルを含めサイト全体をロール必須にする
* DBはAPIのみが接続する（フロントから直接接続しない）

---

# 準備するリソース一覧

以下は「作成・設定」すべきリソースの一覧であり、手順そのものではなく、準備物と決めるべき事項を列挙する。

## 1. GitHub 側の準備

### 1.1 GitHub Organization

* 対象 Organization の確定
* メンバー管理の方針

  * 利用許可＝Orgメンバーであること
  * オフボーディング（退職/異動）時のOrgからの削除を必須運用とする

### 1.2 GitHub App（認証・Organizationメンバー判定の統合）

SWA のカスタム認証（GitHub）と rolesSource による「Orgメンバー判定」を、**単一の GitHub App**で担う。

### 目的

* ログイン（ユーザー認証）：GitHub App の OAuth フロー（client_id / client_secret）
* 認可判定（Orgメンバーシップ確認）：同一 GitHub App の Installation access token（JWT→installation token）で GitHub API を呼び出す

### 作成対象

* GitHub App（1つ）

### 必要情報（確定が必要）

* App 名称
* Homepage URL（SWA 本番 URL）
* Authorization callback URL（SWA の `/.auth/login/<provider>/callback` 形式）

### 必要権限（最小）

* Organization permissions: **Members: Read**（Orgメンバー判定に必要）

### 導入・運用

* 対象 Organization に GitHub App をインストール
* 利用許可＝Orgメンバーであること
* オフボーディング（退職/異動）時のOrgからの削除を必須運用とする

### 生成物

* Client ID（ログイン用）
* Client Secret（ログイン用）
* App ID
* Private Key（installation token 発行用）
* Installation ID（運用上把握が必要な場合）

> 注: 本方式では OAuth App は作成せず、GitHub App に統合する。

---

## 2. Azure 側の準備（SWA/Functions）

### 2.1 Azure Static Web Apps（Standard）

* 作成対象: SWA（Standard）
* 必要情報（確定が必要）

  * リージョン
  * デプロイ方式（GitHub Actions 連携）
  * 本番 URL（のちに OAuth callback に使用）
* 設定対象

  * アプリ設定（環境変数）

    * GitHub OAuth App の Client ID/Secret の格納
  * 認証・認可設定（`staticwebapp.config.json` を想定）

    * カスタム認証（GitHub）
    * rolesSource の有効化（`/api/GetRoles`）
    * 全ルートのロール必須（例: OrgMember）

### 2.2 API ホスティング（Functions）

SWA 統合の Functions は構成が軽い一方、マネージドIDの扱い等で制約が出る可能性があるため、**ユーザー提供 Functions（別 Function App）** を基本方針とする。

* 作成対象（推奨）

  * Azure Functions（別リソースとして作成）
* 目的

  * rolesSource（GetRoles）の実行
  * アプリ API の提供
  * SQL Database 接続の終端
  * Azure Key Vault からの秘密情報取得
* 前提となる準備

  * Function App にシステム割り当てマネージドIDを付与する
  * Key Vault 側で、当該マネージドIDにシークレット参照（Get）権限を付与できること

---

## 2.3 Azure Key Vault（必須）

* 目的

  * GitHub App の Private Key
  * GitHub App の Client Secret（ログイン用）
  * SQL 接続情報（初期は SQL 認証を想定する場合）
  * その他、将来追加される外部連携用シークレット
* 必要情報（確定が必要）

  * リージョン（Functions と近接させる）
  * アクセス制御方式（Key Vault アクセス ポリシー／Azure RBAC のいずれを採用するか）
* 前提となる準備

  * Function App に（原則として）システム割り当てマネージドIDを付与し、Key Vault 側で参照権限を付与する
* 運用方針（準備段階で決める）

  * シークレット命名規約
  * ローテーション方針（漏えい時・定期更新時）

---

## 3. Azure 側の準備（SQL Database）

### 3.1 Azure SQL Database

* 作成対象

  * Azure SQL Database（Free offer を優先候補）
  * Azure SQL logical server（同時に必要）
* 必要情報（確定が必要）

  * リージョン（Functions と近接させる）
  * Free offer の対象・制限の確認（利用枠超過時の方針）

### 3.2 接続方式の方針（準備段階で決める）

ネットワーク閉域化を採らない前提で、まずは以下を基本方針とする。

* 初期方針: **SQL 認証（ユーザー/パスワード）**

  * 初期構築が容易で、Free offer との相性が良い
  * 秘密情報は **Azure Key Vault に格納**し、Functions から取得する

> 注: 将来的に Managed Identity に移行する余地は残すが、本書の範囲では採否判断と前提整理までに留める。

---

## 4. 秘密情報の保管（必須）

### 4.1 Azure Key Vault（必須）

* 目的

  * GitHub App の Private Key
  * SQL 接続情報（方針Aの場合）
  * 必要に応じて OAuth Client Secret
* 期待効果

  * 秘密情報の散在を防ぐ
  * ローテーション時の影響範囲を限定

> 注: 本方式では秘密情報は原則すべて Key Vault に格納し、アプリ設定への平文保管は採らない。

---

# 事前に確定すべき事項（意思決定ポイント）

本件の意思決定ポイントはすべて確定済みとし、提案内容で実施する。

* 「社内からだけ」＝ GitHub Organization 境界（確定）
* 対象 Org 運用は既存に乗る（確定）
* SWA 本番 URL は初期構築時に確定（確定）
* Functions はユーザー提供で構築し、system-assigned Managed Identity を使用（確定）
* SQL は初期は SQL 認証、秘密情報は Key Vault に格納（確定）
* Key Vault は RBAC/アクセスポリシーいずれの方式でも運用可能で、必要権限は満たす（確定）
* ローテーションは「Key Vault の更新」と「元の資格情報の再発行」を分けて設計する（方針確定、詳細は後続）

---

# 最小構成の成立確認のために作るべきもの

目的は「構成要素が正しく結線され、認証・認可・Key Vault参照・DB接続が成立している」ことを、最小の作業量で検証することにある。

## 作るべきもの（最小セット）

### 1. SWA 側（静的）

* 最小ページ 1枚

  * ログイン状態を表示（匿名／ログイン済み）
  * `/api/health` と `/api/dbtime` の結果を表示
* ルーティング/認可

  * `/*` を OrgMember ロール必須
  * `/.auth/*` は匿名許可

### 2. Functions 側（API）

* `GetRoles`（rolesSource）

  * 入力ユーザーを元に、GitHub API で対象Orgのメンバーであることを確認し、OrgMember ロールを返す
* `health`（疎通）

  * Key Vault 参照なしで 200 を返す（SWA→Functions 経路の疎通確認）
* `kvcheck`（秘密情報参照の確認）

  * Key Vault から「ダミーシークレット」を読み、取得可否だけを返す（値自体は返さない）
* `dbtime`（DB接続の確認）

  * SQL Database に接続し、現在時刻（または簡単なSELECT結果）を返す

### 3. Key Vault 側

* ダミーシークレット 1つ

  * `kvcheck` が参照する
* SQL 接続情報（シークレット）

  * `dbtime` が参照する
* GitHub App 秘密鍵・Client Secret

  * `GetRoles` が参照する

### 4. SQL Database 側

* 最小DB 1つ
* （任意）動作確認用テーブル 1つ

  * ただし `SELECT CURRENT_TIMESTAMP` 等で確認できるならテーブル作成は不要

## 合格基準（期待結果）

* Org外ユーザー

  * ログイン後も OrgMember が付与されず、`/*` にアクセスできない
* Orgメンバー

  * ログイン後に `/*` へアクセスできる
  * `/api/health` が 200
  * `/api/kvcheck` が Key Vault 参照成功
  * `/api/dbtime` が SQL 参照成功

---

# 期待されるセキュリティ特性（この方式で満たす範囲）

* GitHub Org 非メンバーは、ログイン後もロール付与されず、サイト全体にアクセスできない
* ブラウザ側に DB 資格情報や共有キーを置かない
* 認可判定は rolesSource でサーバ側に集約する

---

# 既知のリスク・限界

* ネットワーク閉域ではないため、Org メンバーは社外ネットワークからもアクセス可能
* rolesSource はサインイン時評価であるため、Org からの削除が即時反映されない可能性がある（再ログイン等の運用が必要）
* GitHub App の秘密鍵管理が重要（漏えい時の影響が大きい）
* ローテーションは対象ごとに難易度が異なる

  * Key Vault 内の値更新は自動化しやすい
  * GitHub App の鍵/シークレットの再発行を完全自動化できるかは別途検証が必要

---

# 参考（公式・関連）

* SWA カスタム認証（GitHub 登録、rolesSource）

  * [https://learn.microsoft.com/ja-jp/azure/static-web-apps/authentication-custom](https://learn.microsoft.com/ja-jp/azure/static-web-apps/authentication-custom)
* Azure SQL Database Free offer

  * [https://learn.microsoft.com/azure/azure-sql/database/free-offer?view=azuresql-db](https://learn.microsoft.com/azure/azure-sql/database/free-offer?view=azuresql-db)
* GitHub REST API（Org メンバーシップ）

  * [https://docs.github.com/ja/rest/orgs/members](https://docs.github.com/ja/rest/orgs/members)
