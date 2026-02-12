## ADDED Requirements

### Requirement: textlint 設定ファイルの追加
プロジェクトルートに `.textlintrc.json` を配置し、日本語文書校正ルールを設定する。

#### Scenario: textlint ルール設定
- **WHEN** `.textlintrc.json` を作成する
- **THEN** 以下のルールが設定される： `no-mix-dearu-desumasu`（preferInBody/Header/List: "である"）、`preset-japanese`（sentence-length max 150、max-ten max 4、no-doubled-joshi 等）、`preset-ja-spacing`、`preset-jtf-style`、`prh`（icsmedia 辞書参照）

### Requirement: textlint 除外設定の追加
プロジェクトルートに `.textlintignore` を配置し、校正対象外のファイルを定義する。

#### Scenario: 除外対象ファイル
- **WHEN** `.textlintignore` を作成する
- **THEN** `CLAUDE.md`、`AGENTS.md` 等のシステム設定ファイルが除外される

### Requirement: textlint の devDependencies 追加
`package.json` の devDependencies に textlint 本体および各種ルールプリセットを追加する。

#### Scenario: 追加されるパッケージ
- **WHEN** `package.json` を更新する
- **THEN** 以下の devDependencies が追加される： `textlint`、`textlint-rule-no-mix-dearu-desumasu`、`textlint-rule-preset-icsmedia`（GitHub:ics-creative/textlint-rule-preset-icsmedia）、`textlint-rule-preset-ja-spacing`、`textlint-rule-preset-japanese`、`textlint-rule-preset-jtf-style`、`textlint-rule-prh`、`@mermaid-js/mermaid-cli`

### Requirement: textlint の npm scripts 追加
`package.json` の scripts に textlint 実行コマンドを追加する。

#### Scenario: lint:text スクリプト
- **WHEN** `pnpm run lint:text` を実行する
- **THEN** `textlint "**/*.md"` が実行され、すべてのマークダウンファイルが校正チェックされる

#### Scenario: lint:text:fix スクリプト
- **WHEN** `pnpm run lint:text:fix` を実行する
- **THEN** `textlint --fix "**/*.md"` が実行され、自動修正可能な校正エラーが修正される

### Requirement: VS Code textlint 連携
`.vscode/settings.json` に textlint の設定を追加し、エディター上でリアルタイム校正を有効にする。

#### Scenario: textlint エディター設定
- **WHEN** `.vscode/settings.json` を作成する
- **THEN** `textlint.configPath` に `.textlintrc.json` を指定し、`textlint.run` を `onType` に設定する

#### Scenario: textlint 拡張の推奨
- **WHEN** `.vscode/extensions.json` を作成する
- **THEN** recommendations に `3w36zj6.textlint` が含まれる
