## Why

`dev-fixtures/data/` には17件のセッションJSONが配置されているが、対応する元のTeams出席レポートCSVファイルが存在しない。アップロードフローのE2Eテスト、デモ、ドキュメント用途のために、既存のJSONデータに対応するCSVテストデータを作成する必要がある。

## What Changes

- `dev-fixtures/csv/` ディレクトリを新規作成し、17件のTeams出席レポート形式のCSVファイルを配置
  - フロントエンド勉強会: 10セッション
  - TypeScript読書会: 3セッション
  - ソフトウェア設計勉強会: 2セッション
  - インフラ技術研究会: 2セッション
- 各CSVはTeams出席レポート形式（UTF-16LE / タブ区切り / 3セクション構成）に準拠
- CSVから生成されるメンバーID・グループID・セッションIDに合わせて、`dev-fixtures/data/` のJSONファイル（`index.json` と `sessions/*.json`）を更新
- CSV → JSON の変換結果の一貫性を保証

## Capabilities

### New Capabilities

- `csv-test-fixtures`: Teams出席レポート形式のCSVテストデータの作成と管理。UTF-16LE / タブ区切り形式、3セクション構成（要約、参加者、会議中のアクティビティ）に準拠し、CsvTransformerでの変換結果が既存のdev-fixtures JSONと一致することを保証する。

### Modified Capabilities

（既存の仕様の要件変更なし）

## Impact

- **新規作成**: `dev-fixtures/csv/` ディレクトリと17件のCSVファイル
- **更新**: `dev-fixtures/data/index.json` （memberIdとgroupIdの更新）
- **更新**: `dev-fixtures/data/sessions/*.json` （sessionIdとmemberIdの更新）
- **影響なし**: 既存のテスト（`pnpm test`）はすべてパスする必要がある
- **利用**: CsvTransformerのテストデータとして使用可能になる
