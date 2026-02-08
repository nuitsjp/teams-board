## Context

本プロジェクトは React 19 + Vite + Tailwind CSS 4.1 で構築された静的サイト（Azure Blob Storage ホスティング）で、Teamsの参加者レポートを集計・閲覧するダッシュボードツールである。現在「Study Log」「勉強会」というドメイン固有の名称がコードベース全体に浸透しているため、製品名を「TeamsBoard」に変更し、ドメインモデル名を汎用化する。

### 現在の構成

- **フロントエンド**: `src/` 配下のReactコンポーネント群
- **データ**: `public/data/index.json` と `public/data/sessions/*.json` の静的JSON
- **インフラ**: `scripts/infra/` 配下のPowerShellスクリプト（Azure CLI利用）
- **テスト**: `tests/`（Vitest）および `e2e/`（Playwright）
- **ドキュメント**: `README.md`、`docs/architecture.md`

## Goals / Non-Goals

**Goals:**
- 製品名を「Study Log」から「TeamsBoard」に統一的に変更する
- ドメインモデル名を `studyGroups` から汎用的な `groups` に変更する
- コンポーネント名・ファイル名を汎用的なものにリネームする
- サイトヘッダーのタイトルをビルド時の環境変数で設定可能にする
- URLパスを `/study-groups/:id` から `/groups/:id` に変更する
- ドキュメント類を新しい製品名に合わせて更新する

**Non-Goals:**
- UIデザイン・レイアウトの変更（名称とテキストの変更のみ）
- 機能の追加・削除
- 既存のopenspec changeドキュメント（履歴）の書き換え
- データの内容（勉強会名「もくもく勉強会」等）の変更 — これらは実データであり製品名とは無関係
- GitHubリポジトリ名の変更

## Decisions

### 1. ドメインモデル名: `studyGroups` → `groups`

**選択**: `groups`

**代替案**:
- `events` — 会議やイベントを含む広い概念だが、JavaScriptのDOM eventと紛らわしい
- `teams` — Teams製品名と重複して混乱する
- `categories` — グルーピング概念とは異なるニュアンス

**理由**: `groups` はシンプルで汎用的であり、元の「勉強会グループ」の「グループ」部分を活かせる。コードベース内で他の用途と衝突しない。

### 2. コンポーネント・ファイルのリネーム規則

| 変更前 | 変更後 |
|---|---|
| `StudyGroupList.jsx` | `GroupList.jsx` |
| `StudyGroupDetailPage.jsx` | `GroupDetailPage.jsx` |
| `StudyGroupList.test.jsx` | `GroupList.test.jsx` |
| `StudyGroupDetailPage.test.jsx` | `GroupDetailPage.test.jsx` |

**理由**: `StudyGroup` プレフィックスを `Group` に短縮。コンポーネント内の変数名も同様に `studyGroup` → `group`、`studyGroups` → `groups` に変更。

### 3. サイトヘッダーの設定可能化: Viteの `define` + 環境変数

**選択**: Vite の `define` オプションで `import.meta.env.VITE_APP_TITLE` を参照

**代替案**:
- ランタイムでJSONファイルを読み込む — 静的サイトとしては過剰
- `index.html` をビルド時にテンプレート処理 — Viteプラグインが必要で複雑

**理由**: Viteは `VITE_` プレフィックスの環境変数を自動的に `import.meta.env` に展開する。追加の依存関係なしで実現可能。デフォルト値を「TeamsBoard」としておけば、環境変数未設定でも動作する。

**実装方針**:
- `index.html` の `<title>` は Viteの `transformIndexHtml` フックを使い `VITE_APP_TITLE` で差し替え、またはデフォルトの「TeamsBoard」をハードコード
- `App.jsx` のヘッダーテキストは `import.meta.env.VITE_APP_TITLE || 'TeamsBoard'` を参照
- `.env` ファイルにデフォルト値 `VITE_APP_TITLE=TeamsBoard` を設定

### 4. データ構造（index.json）のキー名変更

**選択**: `studyGroups` → `groups` に変更

**理由**: フロントエンドとデータ構造の一貫性を保つため同時に変更する。`public/data/index.json`（開発用ダミーデータ）および `scripts/infra/Clear-StudyData.ps1`（空インデックス生成）の両方を更新。

### 5. UI表示テキストの変更

| 変更前 | 変更後 |
|---|---|
| 「勉強会グループ」 | 「グループ」 |
| 「勉強会詳細画面」（コメント） | 「グループ詳細画面」 |
| 「勉強会別サマリー」（コメント） | 「グループ別サマリー」 |

### 6. インフラスクリプトの更新

- `Clear-StudyData.ps1`: スクリプトの`.SYNOPSIS`コメントとtempファイル名中の `study-log` を `teams-board` に変更。空index.jsonの `studyGroups` → `groups` に変更。
- `Deploy-Infrastructure.ps1`: コメント中の `study-log` 参照とtempファイル名を更新。

### 7. package.jsonの更新

- `name`: `blob-static-dashboard` → `teams-board`
- `description`: `Azure Blob Storage Static website ダッシュボード` → `TeamsBoard — Teamsレポート集計ダッシュボード`
- `infra:clear` スクリプト名: ファイル名変更に合わせて更新（`Clear-StudyData.ps1` → `Clear-Data.ps1`）

## Risks / Trade-offs

- **[データ互換性]** `index.json` の `studyGroups` → `groups` 変更により、既にデプロイ済みの環境ではデータ形式が不整合になる → **緩和策**: デプロイ時に `infra:clear` でデータをリセットし再アップロード。本番環境が存在する場合はマイグレーションスクリプトを検討。
- **[URLの変更]** `/study-groups/:id` → `/groups/:id` により既存ブックマークが壊れる → **緩和策**: ハッシュルーター使用のため外部リンクへの影響は限定的。必要に応じてリダイレクトルートを追加可能。
- **[大量のファイル変更]** ドメインモデル名のリネームにより多数のファイルが変更される → **緩和策**: テスト（ユニット + E2E）で回帰確認。機械的なリネームを中心とし、ロジック変更は最小限に留める。

## Open Questions

- インフラスクリプトのファイル名自体も変更するか（例: `Clear-StudyData.ps1` → `Clear-Data.ps1`）？ — package.jsonのスクリプト参照も含めて更新が必要。
- ヘッダーのアイコン（現在 `BookOpen`）を変更するか？ — 製品のブランドイメージに合わせて検討が必要。
