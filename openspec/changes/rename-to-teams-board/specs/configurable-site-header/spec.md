## ADDED Requirements

### Requirement: サイトタイトルを環境変数で設定できる
システムは、ビルド時の環境変数 `VITE_APP_TITLE` によってサイトタイトル（ブラウザタブの `<title>` タグおよびヘッダーのブランド名表示）を設定できるものとする（SHALL）。環境変数が未設定の場合、デフォルト値として「Teams Board」を使用しなければならない（MUST）。

#### Scenario: 環境変数でカスタムタイトルを設定した場合
- **WHEN** 環境変数 `VITE_APP_TITLE` に「カスタムタイトル」を設定してビルドする
- **THEN** ブラウザタブのタイトルが「カスタムタイトル」と表示される
- **THEN** ヘッダーのブランド名が「カスタムタイトル」と表示される

#### Scenario: 環境変数が未設定の場合
- **WHEN** 環境変数 `VITE_APP_TITLE` を設定せずにビルドする
- **THEN** ブラウザタブのタイトルが「Teams Board」と表示される
- **THEN** ヘッダーのブランド名が「Teams Board」と表示される

### Requirement: デフォルト環境変数ファイルにサイトタイトルが定義されている
プロジェクトルートの `.env` ファイルに `VITE_APP_TITLE=Teams Board` がデフォルト値として定義されていなければならない（MUST）。これにより、環境変数を明示的に設定しなくても開発時・ビルド時に適切なタイトルが適用される。

#### Scenario: .envファイルによるデフォルト値の適用
- **WHEN** `.env` ファイルが存在し `VITE_APP_TITLE=Teams Board` が定義されている
- **WHEN** 追加の環境変数設定なしで `pnpm run dev` を実行する
- **THEN** ヘッダーのブランド名が「Teams Board」と表示される

#### Scenario: .env.localで上書きする場合
- **WHEN** `.env.local` ファイルに `VITE_APP_TITLE=MyDashboard` を定義する
- **WHEN** `pnpm run dev` を実行する
- **THEN** ヘッダーのブランド名が「MyDashboard」と表示される

### Requirement: ヘッダーのブランド名表示が動的に解決される
`App.jsx` のヘッダーコンポーネントは、ハードコードされた文字列ではなく `import.meta.env.VITE_APP_TITLE` を参照してブランド名を表示しなければならない（MUST）。フォールバック値として「Teams Board」を使用する（SHALL）。

#### Scenario: ヘッダーがimport.meta.envからタイトルを取得する
- **WHEN** アプリケーションが読み込まれる
- **THEN** ヘッダーのブランド名は `import.meta.env.VITE_APP_TITLE` の値を表示する
- **THEN** 値が空またはundefinedの場合は「Teams Board」を表示する
