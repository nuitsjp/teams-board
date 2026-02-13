## ADDED Requirements

### Requirement: サイト説明文を環境変数で設定できる

システムは、ビルド時の環境変数 `VITE_APP_DESCRIPTION` によってヘッダーの説明文を設定できるものとする（SHALL）。環境変数が未設定または空文字の場合、説明文は表示しない（MUST NOT）。

#### Scenario: 環境変数で説明文を設定した場合

- **WHEN** 環境変数 `VITE_APP_DESCRIPTION` に「Teams レポート集計ダッシュボード」を設定してビルドする
- **THEN** ヘッダーのタイトル右隣に「Teams レポート集計ダッシュボード」が表示される
- **THEN** 説明文はタイトルより小さく控えめなスタイルで表示される

#### Scenario: 環境変数が未設定の場合

- **WHEN** 環境変数 `VITE_APP_DESCRIPTION` を設定せずにビルドする
- **THEN** ヘッダーにはタイトルのみ表示され、説明文の要素は描画されない

#### Scenario: 環境変数が空文字の場合

- **WHEN** 環境変数 `VITE_APP_DESCRIPTION` に空文字を設定してビルドする
- **THEN** ヘッダーにはタイトルのみ表示され、説明文の要素は描画されない

### Requirement: ヘッダーの説明文がハードコードされていない

`App.jsx` のヘッダーコンポーネントは、ハードコードされた文字列ではなく `import.meta.env.VITE_APP_DESCRIPTION` を参照して説明文を表示しなければならない（MUST）。Vite がビルド時に環境変数を文字列リテラルに置換するため、実行時の動的解決は発生しない。値が truthy な場合のみ `<span>` 要素を描画する（SHALL）。

#### Scenario: ビルド成果物に環境変数の値が埋め込まれる

- **WHEN** `VITE_APP_DESCRIPTION` に値を設定してビルドする
- **THEN** ビルド成果物のヘッダー部分に設定した値が文字列リテラルとして埋め込まれる

#### Scenario: 説明文が未設定時に余分な DOM 要素が生成されない

- **WHEN** `VITE_APP_DESCRIPTION` が未設定の状態でビルドする
- **THEN** 説明文用の `<span>` 要素は DOM に存在しない

### Requirement: 環境変数テンプレートに説明文の設定例が含まれる

`.env.example` ファイルに `VITE_APP_DESCRIPTION` がコメント付きで記載されていなければならない（MUST）。これにより、利用者が設定可能な項目を把握できる。

#### Scenario: .env.example に説明文の設定例がある

- **WHEN** `.env.example` ファイルを参照する
- **THEN** `VITE_APP_DESCRIPTION` の記載が存在する
- **THEN** 設定方法が理解できるコメントまたは例が記載されている

### Requirement: 説明文は狭い画面で非表示になる

ヘッダーの説明文は、画面幅が狭いデバイスでは非表示にしなければならない（MUST）。タイトルの表示を優先し、レイアウトの崩れを防止する。

#### Scenario: スマートフォン幅の画面で説明文が非表示になる

- **WHEN** 画面幅が 640px 未満である
- **WHEN** `VITE_APP_DESCRIPTION` に値が設定されている
- **THEN** 説明文は表示されない
- **THEN** タイトルは通常通り表示される

#### Scenario: デスクトップ幅の画面で説明文が表示される

- **WHEN** 画面幅が 640px 以上である
- **WHEN** `VITE_APP_DESCRIPTION` に値が設定されている
- **THEN** タイトルの右隣に説明文が表示される
