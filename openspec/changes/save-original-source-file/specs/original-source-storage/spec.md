## ADDED Requirements

### Requirement: ソースCSVファイルのセッションID紐づけ保存
管理機能でTeams出席レポートCSVをアップロードした際、システムはオリジナルのCSVファイルを `data/sources/{sessionId}.csv` パスに保存しなければならない（SHALL）。sessionId はCSV変換処理で生成されるセッションIDと同一のものを使用しなければならない（MUST）。

#### Scenario: 正常なCSVアップロード時のソースファイル保存
- **WHEN** 管理者が有効なTeams出席レポートCSVをアップロードし一括保存を実行する
- **THEN** システムはオリジナルのCSVファイルを `data/sources/{sessionId}.csv` に保存する
- **THEN** 保存されるファイルの内容はアップロードされたファイルと完全に同一である

#### Scenario: 複数ファイルの一括アップロード時
- **WHEN** 管理者が複数のCSVファイルを一括アップロードし保存を実行する
- **THEN** 各CSVファイルがそれぞれのセッションIDに対応する `data/sources/{sessionId}.csv` に保存される

### Requirement: セッションデータとソースファイルの一対一対応
各セッションの変換後JSON（`data/sessions/{sessionId}.json`）とソースCSV（`data/sources/{sessionId}.csv`）は同一のセッションIDで一対一に対応しなければならない（MUST）。

#### Scenario: セッションJSONとソースCSVの対応関係
- **WHEN** CSVファイルのアップロードと保存が正常に完了した場合
- **THEN** `data/sessions/{sessionId}.json` と `data/sources/{sessionId}.csv` が同一の sessionId で存在する

### Requirement: rawディレクトリへの保存廃止
システムは `raw/{timestamp}-{filename}.csv` パスへのファイル保存を行わないようにしなければならない（MUST）。タイムスタンプベースのパス生成ロジックは削除する。

#### Scenario: アップロード時にrawディレクトリへ保存されない
- **WHEN** 管理者がCSVファイルをアップロードし一括保存を実行する
- **THEN** `raw/` ディレクトリへのファイル書き込みは発生しない
- **THEN** ソースファイルは `data/sources/` ディレクトリにのみ保存される
