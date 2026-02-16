## ADDED Requirements

### Requirement: ビルド成果物の HTML にサイトタイトルが埋め込まれる

ビルド成果物の `index.html` の `<title>` タグには、ビルド時点の `VITE_APP_TITLE` 環境変数の値が埋め込まれていなければならない（MUST）。JavaScript の実行を待たずに、HTML パース時点でブラウザタブに正しいタイトルが表示されるものとする（SHALL）。

#### Scenario: ビルド成果物に環境変数のタイトルが埋め込まれている場合

- **WHEN** 環境変数 `VITE_APP_TITLE` に「カスタムタイトル」を設定してビルドする
- **THEN** ビルド成果物 `dist/index.html` の `<title>` タグの内容が「カスタムタイトル」である

#### Scenario: 環境変数が未設定でビルドした場合

- **WHEN** 環境変数 `VITE_APP_TITLE` を設定せずにビルドする
- **THEN** ビルド成果物 `dist/index.html` の `<title>` タグの内容が「Teams Board」である

#### Scenario: 開発サーバーでもタイトルが反映される場合

- **WHEN** 環境変数 `VITE_APP_TITLE` に「開発用タイトル」を設定して `pnpm run dev` を実行する
- **THEN** ブラウザタブのタイトルが「開発用タイトル」と表示される
