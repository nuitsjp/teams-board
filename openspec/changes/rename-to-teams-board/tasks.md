## 1. 環境変数によるサイトヘッダー設定機能

- [x] 1.1 プロジェクトルートに `.env` ファイルを作成し `VITE_APP_TITLE=TeamsBoard` を定義する
- [x] 1.2 `index.html` の `<title>Study Log</title>` を `<title>TeamsBoard</title>` に変更する（※Viteビルド時に環境変数で上書き可能な構成を検討）
- [x] 1.3 `src/App.jsx` のヘッダーテキスト `Study Log` を `import.meta.env.VITE_APP_TITLE || 'TeamsBoard'` に変更する
- [x] 1.4 `.gitignore` に `.env.local` が含まれていることを確認する

## 2. ドメインモデル名のリネーム（studyGroups → groups）

- [x] 2.1 `public/data/index.json` の `studyGroups` キーを `groups` に変更する
- [x] 2.2 `src/services/index-merger.js` の `studyGroups` 参照をすべて `groups` に変更する（変数名、プロパティアクセス、コメント）
- [x] 2.3 `src/pages/DashboardPage.jsx` の `studyGroups` 変数・参照を `groups` に変更する
- [x] 2.4 `src/pages/MemberDetailPage.jsx` の `studyGroupAttendances` → `groupAttendances`、その他 `studyGroup` 関連の変数名・コメントを変更する

## 3. コンポーネント・ファイルのリネーム

- [x] 3.1 `src/components/StudyGroupList.jsx` → `src/components/GroupList.jsx` にリネームし、エクスポート名を `GroupList` に変更、UI表示テキスト「勉強会グループ」を「グループ」に変更する
- [x] 3.2 `src/pages/StudyGroupDetailPage.jsx` → `src/pages/GroupDetailPage.jsx` にリネームし、エクスポート名を `GroupDetailPage` に変更、コメント「勉強会詳細画面」を「グループ詳細画面」に変更、`studyGroupId` → `groupId` に変更する
- [x] 3.3 `src/App.jsx` の import パスとルーティング定義を更新する（`StudyGroupDetailPage` → `GroupDetailPage`、`StudyGroupList` が使われている箇所、パス `/study-groups/:studyGroupId` → `/groups/:groupId`）
- [x] 3.4 `src/pages/DashboardPage.jsx` の `StudyGroupList` import を `GroupList` に変更する
- [x] 3.5 `src/components/GroupList.jsx`（旧 StudyGroupList）内のナビゲーションパス `/study-groups/` → `/groups/` に変更する

## 4. テストファイルの更新

- [x] 4.1 `tests/react/components/StudyGroupList.test.jsx` → `tests/react/components/GroupList.test.jsx` にリネームし、import名・テスト名・コメント内の「勉強会」を「グループ」に変更する
- [x] 4.2 `tests/react/pages/StudyGroupDetailPage.test.jsx` → `tests/react/pages/GroupDetailPage.test.jsx` にリネームし、import名・テスト名・パラメータ名を更新する
- [x] 4.3 `tests/react/pages/DashboardPage.test.jsx` の `studyGroups` 参照を `groups` に変更する
- [x] 4.4 `tests/react/pages/MemberDetailPage.test.jsx` の `studyGroup` 関連の変数名・テスト名を更新する
- [x] 4.5 `tests/data/index-merger.test.js` の `studyGroups` 参照を `groups` に変更する
- [x] 4.6 `e2e/dashboard.spec.js` の「勉強会グループ」→「グループ」、`/study-groups/` → `/groups/`、テスト名の「勉強会」→「グループ」に変更する

## 5. インフラスクリプトの更新

- [x] 5.1 `scripts/infra/Clear-StudyData.ps1` を `scripts/infra/Clear-Data.ps1` にリネームし、コメント・変数名の「study-log」「勉強会」を汎用表現に変更、空index.jsonの `studyGroups` → `groups` に変更する
- [x] 5.2 `scripts/infra/Deploy-Infrastructure.ps1` のコメント・tempファイル名中の `study-log` を `teams-board` に変更する
- [x] 5.3 `package.json` の `infra:clear` スクリプトパスを `Clear-Data.ps1` に更新する

## 6. 設定ファイル・ドキュメントの更新

- [x] 6.1 `package.json` の `name` を `teams-board` に、`description` を `TeamsBoard — Teamsレポート集計ダッシュボード` に変更する
- [x] 6.2 `README.md` のプロジェクト名・説明をTeamsBoardに更新する
- [x] 6.3 `docs/architecture.md` の「Study Log」「study-log」をTeamsBoardに更新する

## 7. テスト実行・動作確認

- [x] 7.1 `pnpm run test` でユニットテストが全件パスすることを確認する
- [x] 7.2 `pnpm run build` でビルドが成功することを確認する
- [x] 7.3 `pnpm run test:e2e` でE2Eテストが全件パスすることを確認する
