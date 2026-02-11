## ADDED Requirements

### Requirement: 開発用ダミートークンの認識

開発環境（`import.meta.env.DEV === true`）において、URLクエリパラメータ`?token=dev`で管理者モードに入ることができなければならない（MUST）。

#### Scenario: 開発環境でダミートークンを使用

- **WHEN** 開発環境（`pnpm run dev`）で`http://localhost:5173/?token=dev`にアクセスする
- **THEN** `useAuth`が`isAdmin: true`を返す
- **THEN** 管理者専用機能（AdminPage）にアクセスできる

#### Scenario: 本番環境でダミートークンが無効

- **WHEN** 本番ビルド環境で`?token=dev`のURLにアクセスする
- **THEN** `useAuth`が`isAdmin: false`を返す
- **THEN** 管理者専用機能にアクセスできない

#### Scenario: ダミートークン使用後のURL

- **WHEN** 開発環境で`?token=dev`でアクセスする
- **THEN** `useAuth`がトークンをメモリに保持する
- **THEN** `history.replaceState`によりURLから`?token=dev`が削除される
- **THEN** URLが`http://localhost:5173/`（クエリパラメータなし）になる

### Requirement: 実際のSASトークンとの共存

開発環境において、実際のAzure Blob Storage SASトークンを使用した認証も引き続きサポートしなければならない（MUST）。

#### Scenario: 実際のSASトークンを使用

- **WHEN** 開発環境で`?token=<valid-sas-token>`でアクセスする（`dev`以外のトークン）
- **THEN** `useAuth`が実際のSASトークンとして処理する
- **THEN** `isAdmin: true`を返す
- **THEN** BlobWriterが実際のAzure Blob Storageに書き込む

### Requirement: 環境検出の精度

開発環境の検出は、Viteの`import.meta.env.DEV`を使用しなければならない（MUST）。

#### Scenario: Vite開発サーバーでの検出

- **WHEN** `pnpm run dev`で起動した環境でコードを実行する
- **THEN** `import.meta.env.DEV`が`true`を返す
- **THEN** ダミートークン`dev`が有効になる

#### Scenario: 本番ビルドでの検出

- **WHEN** `pnpm run build`でビルドされたコードを実行する
- **THEN** `import.meta.env.DEV`が`false`を返す（またはundefined）
- **THEN** ダミートークン`dev`が無効になる

#### Scenario: Tree-shakingによるコード除去

- **WHEN** 本番ビルド（`pnpm run build`）を実行する
- **THEN** `import.meta.env.DEV`が静的に評価される
- **THEN** 開発用コードがビルド結果から除去される（Tree-shaking）

### Requirement: セキュリティの保証

本番環境で`?token=dev`が管理者権限を付与してはならない（MUST NOT）。

#### Scenario: 本番環境での不正アクセス試行

- **WHEN** 本番環境（Azure Blob Storage静的サイト）で`?token=dev`でアクセスする
- **THEN** `useAuth`が`isAdmin: false`を返す
- **THEN** 管理者機能へのアクセスが拒否される
- **THEN** コンソールにエラーや警告が表示されない（攻撃者に情報を与えない）

### Requirement: 開発者体験の向上

ダミートークンの使用方法は、シンプルで直感的でなければならない（MUST）。

#### Scenario: 開発者がすぐに使用できる

- **WHEN** 開発者がREADMEやドキュメントを読む
- **THEN** `?token=dev`の使用方法が明確に記載されている
- **THEN** 追加の設定や環境変数の準備が不要である

#### Scenario: エラー時のフィードバック

- **WHEN** 開発環境で`?token=dev`を使用してAdminPageにアクセスする
- **THEN** コンソールに「開発モード: ダミートークンを使用中」といった情報メッセージが表示される（開発者への確認）
