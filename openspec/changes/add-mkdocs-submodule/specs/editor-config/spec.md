## ADDED Requirements

### Requirement: .editorconfig の追加
プロジェクトルートに `.editorconfig` を配置し、エディター間のコーディングスタイルを統一する。

#### Scenario: 全ファイル共通設定
- **WHEN** `.editorconfig` を作成する
- **THEN** `root = true`、全ファイルに `indent_style = space`、`indent_size = 4`、`end_of_line = lf`、`charset = utf-8`、`trim_trailing_whitespace = true`、`insert_final_newline = true` が設定される

#### Scenario: ファイルタイプ別設定
- **WHEN** `.editorconfig` を作成する
- **THEN** JSON ファイルは `indent_size = 2`、YAML ファイルは `indent_size = 2`、Markdown ファイルは `trim_trailing_whitespace = false`、PowerShell は `indent_size = 4`、Bash は `indent_size = 2` が設定される

### Requirement: .gitattributes の追加
プロジェクトルートに `.gitattributes` を配置し、改行コードを LF に統一する。

#### Scenario: 改行コードの統一
- **WHEN** `.gitattributes` を作成する
- **THEN** `* text=auto eol=lf` が設定される

### Requirement: VS Code 設定の追加
`.vscode/settings.json` にプロジェクト共通の VS Code 設定を追加する。

#### Scenario: cSpell 辞書
- **WHEN** `.vscode/settings.json` を作成する
- **THEN** `cSpell.words` に Teams Board プロジェクト固有の用語（mkdocs、textlint、pymdownx、pyproject 等）が登録される
