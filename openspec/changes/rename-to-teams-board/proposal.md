## Why

現在「StudyLog」という勉強会のログ保存に特化した製品名となっているが、実際にはTeamsの参加者レポートを集計する汎用的なダッシュボードツールである。勉強会以外のユースケース（会議、研修、イベントなど）にも対応できるよう、製品名を「Teams Board」に変更し、ドメイン固有の表現を汎用的なものに置き換える。

## What Changes

- **BREAKING** サイトタイトル・ヘッダーを「Study Log」から「Teams Board」に変更（`index.html`、`App.jsx`）
- **BREAKING** サイトヘッダーのタイトルをデプロイ時に外部から指定できる仕組みを導入（環境変数またはビルド設定）
- UI上の「勉強会グループ」表記を汎用的な表現（例：「グループ」「イベント」等）に変更
- `studyGroups` → 汎用的なドメインモデル名への変更（ソースコード内の変数名・型名・コンポーネント名）
- URLパス `/study-groups/:id` → 汎用的なパスへの変更
- `README.md` の製品説明・プロジェクト名をTeams Boardに更新
- `docs/architecture.md` の製品名・説明をTeams Boardに更新
- インフラスクリプト内の「study-log」固有の記述を汎用名に変更（`Clear-StudyData.ps1`、`Deploy-Infrastructure.ps1`）
- `package.json` の `name` および `description` をTeams Boardに更新
- コンポーネント名の変更： `StudyGroupList` → 汎用名、`StudyGroupDetailPage` → 汎用名
- テストファイル内の勉強会固有の記述・テスト名を汎用表現に更新
- 既存のopenspec changeドキュメント内の「Study Log」「勉強会」記述はそのまま維持（履歴として）

## Capabilities

### New Capabilities

- `configurable-site-header`: サイトヘッダー（タイトル・ブランド名）をデプロイ時に外部から設定できる機能

### Modified Capabilities

- （既存のopenspec/specsは空のため、変更対象なし）

## Impact

- **ソースコード**: `src/` 配下のほぼ全コンポーネント・サービスに影響（コンポーネント名、変数名、UIテキスト、ルーティングパス）
  - `App.jsx` — ヘッダー、ルーティング定義
  - `DashboardPage.jsx` — studyGroups変数、コメント
  - `StudyGroupDetailPage.jsx` → リネーム対象
  - `MemberDetailPage.jsx` — studyGroupAttendances変数、コメント
  - `StudyGroupList.jsx` → リネーム対象
  - `data-fetcher.js`、`index-merger.js` — ドメインモデル名
- **テスト**: `tests/` および `e2e/` 配下のテストファイル全般
- **インフラ**: `scripts/infra/` 配下のPowerShellスクリプト
- **ドキュメント**: `README.md`、`docs/architecture.md`
- **設定ファイル**: `index.html`、`package.json`
- **データ構造**: `public/data/index.json` の `studyGroups` キー名（**BREAKING** — 既存データとの後方互換性に注意）
