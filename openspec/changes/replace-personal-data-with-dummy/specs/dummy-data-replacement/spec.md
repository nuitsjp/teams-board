## ADDED Requirements

### Requirement: 公開データのメンバー名をダミーに置き換える
`public/data/index.json` の `members` 配列に含まれる全メンバーの `name` フィールドを、実際に存在しそうな自然なダミー名に置き換えなければならない（SHALL）。置き換え後もデータ構造（JSON スキーマ）は変更してはならない（MUST NOT）。

#### Scenario: メンバー名の置き換え
- **WHEN** `public/data/index.json` を確認する
- **THEN** 全メンバーの `name` が以下のダミー名に置き換わっている
  - `Nakamura Atsushi A (中村 充志)` → `Suzuki Taro A (鈴木 太郎)`
  - `Yamaura Tetsuro (山浦 哲朗)` → `Tanaka Koji (田中 浩二)`
  - `Sai Bun A (崔 文)` → `Yamamoto Yuki A (山本 裕貴)`
  - `Yato Daisuke (谷戸 大輔)` → `Watanabe Kenji (渡辺 健二)`

#### Scenario: メンバーIDとセッション参照の維持
- **WHEN** メンバー名を置き換えた後に `public/data/index.json` を確認する
- **THEN** 各メンバーの `id`、`totalDurationSeconds`、`sessionIds` は変更されていない

### Requirement: 公開データの勉強会名をダミーに置き換える
`public/data/index.json` の `groups` 配列に含まれる全グループの `name` フィールドを、実際に存在しそうな自然なダミー勉強会名に置き換えなければならない（SHALL）。

#### Scenario: 勉強会名の置き換え
- **WHEN** `public/data/index.json` を確認する
- **THEN** 全グループの `name` が以下のダミー名に置き換わっている
  - `もくもく勉強会` → `フロントエンド勉強会`
  - `React読書会` → `TypeScript読書会`
  - `アーキテクチャ設計塾` → `ソフトウェア設計勉強会`
  - `クラウド技術研究会` → `インフラ技術研究会`

#### Scenario: グループIDとセッション参照の維持
- **WHEN** 勉強会名を置き換えた後に `public/data/index.json` を確認する
- **THEN** 各グループの `id`、`totalDurationSeconds`、`sessionIds` は変更されていない

### Requirement: テストファイルのテストデータをダミーに置き換える
`tests/` 配下のテストファイルに含まれるテスト用の人名・メールアドレス・勉強会名を、自然なダミー名に置き換えなければならない（SHALL）。置き換え後も全テストがパスしなければならない（MUST）。

#### Scenario: テスト用人名の置き換え
- **WHEN** テストファイル内のテストデータを確認する
- **THEN** 以下の置き換えが行われている
  - `テスト太郎` → `佐藤 一郎`
  - `テスト花子` → `高橋 美咲`
  - `taro@example.com` → `ichiro.sato@example.com`
  - `hanako@example.com` → `misaki.takahashi@example.com`

#### Scenario: テスト用勉強会名の置き換え
- **WHEN** テストファイル内の勉強会名を確認する
- **THEN** `もくもく勉強会` → `フロントエンド勉強会`、`React読書会` → `TypeScript読書会` 等、designのマッピングに従って置き換えられている

#### Scenario: テストの整合性維持
- **WHEN** 全テストデータの置き換え後にテストスイートを実行する
- **THEN** 全てのユニットテストがパスする

### Requirement: E2Eテストのデータ参照をダミーに合わせる
`e2e/dashboard.spec.js` 内で参照している実名・勉強会名を、`public/data/index.json` に合わせたダミー名に更新しなければならない（SHALL）。

#### Scenario: E2Eテスト内の勉強会名の更新
- **WHEN** `e2e/dashboard.spec.js` を確認する
- **THEN** `もくもく勉強会`、`React読書会`、`アーキテクチャ設計塾`、`クラウド技術研究会` がそれぞれダミー名に置き換わっている

#### Scenario: E2Eテスト内の人名の更新
- **WHEN** `e2e/dashboard.spec.js` を確認する
- **THEN** `中村 充志` がダミー名 `鈴木 太郎` に置き換わっている

### Requirement: ドキュメントのサンプルデータをダミーに置き換える
`docs/architecture.md` 内のサンプルデータに含まれる実名・勉強会名を、ダミー名に更新しなければならない（SHALL）。

#### Scenario: ドキュメント内の個人情報の置き換え
- **WHEN** `docs/architecture.md` を確認する
- **THEN** `もくもく勉強会` がダミー名に置き換わっている
- **THEN** `Nakamura Atsushi A (中村 充志)` がダミー名に置き換わっている

### Requirement: 置き換え後に元の個人情報が残っていないことを検証する
全ファイルの置き換え完了後、リポジトリ内に元の個人情報が残っていないことを検証しなければならない（MUST）。

#### Scenario: 元の実名が残っていないことの確認
- **WHEN** リポジトリ全体を元の実名（中村 充志、山浦 哲朗、崔 文、谷戸 大輔）でgrep検索する
- **THEN** いずれの実名もヒットしない

#### Scenario: 元の勉強会名が残っていないことの確認
- **WHEN** リポジトリ全体を元の勉強会名（もくもく勉強会、React読書会、アーキテクチャ設計塾、クラウド技術研究会）でgrep検索する
- **THEN** いずれの勉強会名もヒットしない（openspec/changes配下のartifactファイルを除く）
