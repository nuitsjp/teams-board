## ADDED Requirements

### Requirement: CSV files SHALL use Teams attendance report format

CSVファイルは、Microsoft Teams出席レポートの実際のフォーマットに準拠しなければならない（MUST）。エンコーディングはUTF-16LE、区切り文字はタブ、3つのセクション（要約、参加者、会議中のアクティビティ）で構成される。

#### Scenario: CSV file with correct encoding and delimiter

- **WHEN** CSVファイルが作成される
- **THEN** ファイルのエンコーディングはUTF-16LEである
- **THEN** フィールドの区切り文字はタブである

#### Scenario: CSV file with three sections

- **WHEN** CSVファイルが作成される
- **THEN** ファイルは「1. 要約」セクションを含む
- **THEN** ファイルは「2. 参加者」セクションを含む
- **THEN** ファイルは「3. 会議中のアクティビティ」セクションを含む

#### Scenario: Summary section with required fields

- **WHEN** 要約セクションが作成される
- **THEN**「会議のタイトル」フィールドにグループ名が含まれる
- **THEN**「開始時刻」フィールドに「YYYY/M/D HH:MM:SS」形式の日時が含まれる

#### Scenario: Participants section with required fields

- **WHEN** 参加者セクションが作成される
- **THEN** ヘッダー行に「名前」「メール アドレス」「会議の長さ」が含まれる
- **THEN** 各参加者行に名前、メールアドレス、時間（「X 時間 Y 分 Z 秒」形式）が含まれる

### Requirement: CSV files SHALL be placed in dev-fixtures/csv directory

CSVファイルは `dev-fixtures/csv/` ディレクトリに配置されなければならない（MUST）。このディレクトリは開発用のテストデータであることを明確にし、`dev-fixtures/data/` の入力データとして機能する。

#### Scenario: CSV directory exists

- **WHEN** テストデータを作成する
- **THEN** `dev-fixtures/csv/` ディレクトリが存在する

#### Scenario: All CSV files are in correct directory

- **WHEN** 17件のCSVファイルが作成される
- **THEN** すべてのファイルが `dev-fixtures/csv/` ディレクトリ直下に配置される

### Requirement: CSV files SHALL follow naming convention

CSVファイルの命名規則は `{グループ名}-{YYYY-MM-DD}.csv` でなければならない（MUST）。これにより、対応するセッションJSONとの関連が明確になる。

#### Scenario: File name matches session date

- **WHEN** セッションの日付が2026-01-15である
- **THEN** CSVファイル名に「2026-01-15」が含まれる

#### Scenario: File name matches group name

- **WHEN** グループ名が「フロントエンド勉強会」である
- **THEN** CSVファイル名が「フロントエンド勉強会-{日付}.csv」である

### Requirement: CSV data SHALL cover all existing sessions

CSVファイルは、既存の17件のセッションJSON、4つのグループ、4人のメンバーをすべてカバーしなければならない（MUST）。

#### Scenario: All groups are covered

- **WHEN** CSVファイルを作成する
- **THEN** フロントエンド勉強会の10セッションが含まれる
- **THEN** TypeScript読書会の3セッションが含まれる
- **THEN** ソフトウェア設計勉強会の2セッションが含まれる
- **THEN** インフラ技術研究会の2セッションが含まれる

#### Scenario: Total file count matches sessions

- **WHEN** すべてのCSVファイルを作成する
- **THEN** ファイル数は17である

### Requirement: CSV to JSON conversion SHALL match existing data

CSVファイルをCsvTransformerで変換した結果は、`dev-fixtures/data/` の既存JSONと一致しなければならない（MUST）。これにより、CSV → JSON の変換結果の一貫性が保証される。

#### Scenario: Generated IDs match existing IDs

- **WHEN** CSVファイルをCsvTransformerで変換する
- **THEN** 生成されるgroupIdが既存の `index.json` のgroupIdと一致する
- **THEN** 生成されるmemberIdが既存の `index.json` のmemberIdと一致する
- **THEN** 生成されるsessionIdが既存のセッションJSONのidと一致する

#### Scenario: Generated session data matches existing data

- **WHEN** CSVファイルをCsvTransformerで変換する
- **THEN** 生成されるattendancesが既存のセッションJSONのattendancesと一致する
- **THEN** 生成されるdurationSecondsが既存のセッションJSONのdurationSecondsと一致する

### Requirement: Existing tests SHALL continue to pass

既存のテスト（`pnpm test`）はすべてパスし続けなければならない（MUST）。CSVテストデータの追加により、既存のテストが壊れてはならない。

#### Scenario: Unit tests pass after CSV creation

- **WHEN** CSVファイルとJSONファイルを更新する
- **THEN** `pnpm test` がすべてパスする

#### Scenario: E2E tests pass after CSV creation

- **WHEN** CSVファイルとJSONファイルを更新する
- **THEN** `pnpm run test:e2e` がすべてパスする
