# Research & Design Decisions

## Summary
- **Feature**: `repo-structure-redesign`
- **Discovery Scope**: Extension（既存構造のリファクタリング）
- **Key Findings**:
  - `src/` 内の相対インポートは全て `../` 1段で完結しており、ディレクトリ移動後もパス修正不要
  - テストファイルは `../../src/` や `../../local-batch/` パターンを使用。ルート直下移動により `../src/` に短縮
  - `scripts/convert-local-data.mjs` は `__dirname` ベースの動的パス解決を使用。ルート直下移動でパス解決ロジックの簡素化が必要

## Research Log

### インポートパス影響分析

- **Context**: ディレクトリ平坦化に伴い、相対インポートパスの修正が必要な範囲を特定
- **Findings**:
  - `src/` 内部のファイル間インポート: **修正不要**（`src/` ディレクトリ自体の内部構造は変わらないため）
  - `local-batch/` → `src/services/`: 現在 `'../src/services/xxx.js'`、移動後 `'../services/xxx.js'`（`local-batch` が `src/` 内に移動するため）
  - `tests/` → `src/`: 現在 `'../../src/services/xxx.js'` 等、移動後 `'../src/services/xxx.js'`（1段短縮）
  - `tests/` → `local-batch/`: 現在 `'../../local-batch/xxx.js'`、移動後 `'../src/local-batch/xxx.js'`
  - `scripts/convert-local-data.mjs`: `projectRoot` を3段上 → ルート直下では1段上に変更
- **Implications**: テストとローカルバッチのインポートパスの一括修正が必要。`src/` 内部は修正不要

### GitHub Actions CI ワークフロー

- **Context**: 現在 `working-directory: frontend/dashboard` で動作。ルート移動後の影響
- **Findings**:
  - `working-directory` ディレクティブの削除が必要
  - `paths` フィルタを `frontend/dashboard/**` からルート直下パスに変更
  - `cache-dependency-path` を `frontend/dashboard/package-lock.json` → `package-lock.json` に変更
- **Implications**: CIワークフローの修正は単純な文字列置換で完了

### Vite 静的アセット解決

- **Context**: `public/` ディレクトリのViteにおける扱いを確認
- **Findings**:
  - Viteはデフォルトでプロジェクトルートの `public/` を静的アセットディレクトリとして扱う
  - 現在の `frontend/dashboard/public/` はすでにViteの規約に従っている
  - ルート直下に移動しても `public/` の挙動は変わらない
- **Implications**: Vite設定における `public/` への特別な設定は不要

### .gitignore の影響

- **Context**: ファイル移動後に `.gitignore` パターンが有効か確認
- **Findings**:
  - 現在のパターン（`node_modules/`, `dist`, `coverage`, `playwright-report/`, `test-results/`）はすべて相対パターン
  - ルート直下に移動しても機能する
- **Implications**: `.gitignore` の修正は不要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| フラットルート構造 | package.jsonをルート直下に配置し、src/tests/e2e/ を直接管理 | パス解決の簡素化、直感的な構造、monorepo不要 | 大規模なファイル移動とパス修正が必要 | 選択。単一アプリ構成に最適 |
| モノレポ維持 | frontend/dashboard/ 構造を維持し、ルートpackage.jsonでワークスペース管理 | 将来の拡張に対応 | 過剰な複雑性、実質1アプリしかない | 不採用。YAGNIの原則に反する |

## Design Decisions

### Decision: `local-batch` の配置先

- **Context**: `local-batch/` は現在 `frontend/dashboard/` 直下（`src/` 外）に配置。移動先の選択
- **Alternatives Considered**:
  1. `src/local-batch/` — アプリケーションコードの一部として管理
  2. `tools/` — トップレベルのツールディレクトリとして分離
- **Selected Approach**: `src/local-batch/` に配置
- **Rationale**: `local-batch` は `src/services/` のモジュールを直接インポートしており、アプリケーションコードと密結合。`src/` 内に配置することでインポートパスが簡素化（`../services/` で参照可能）
- **Trade-offs**: `src/` がビルド対象とツールコードの混在になるが、Viteのビルドは `main.jsx` からのエントリーポイントを辿るため、`local-batch/` がバンドルに含まれることはない

### Decision: スクリプトディレクトリの統合方式

- **Context**: Azure運用スクリプト（`scripts/`）とバッチ実行スクリプト（`frontend/dashboard/scripts/`）の統合方法
- **Alternatives Considered**:
  1. `scripts/infra/` + `scripts/convert-local-data.mjs` — サブディレクトリで分離
  2. `scripts/` にフラットに統合
- **Selected Approach**: `scripts/infra/` でインフラスクリプトを分離し、バッチ実行スクリプトは `scripts/` 直下
- **Rationale**: インフラスクリプト（PowerShell）とバッチ実行スクリプト（Node.js）は技術スタックが異なり、役割も明確に分かれている
- **Trade-offs**: ディレクトリ1階層増えるが、関心の分離が明確になる

## Risks & Mitigations
- **Git履歴の断絶**: `git mv` を使用してファイル移動を行い、リネーム検出を維持する
- **インポートパスの修正漏れ**: テスト全件実行とビルド検証で網羅的に確認
- **CI/CDの一時的な破損**: ワークフロー修正を同一コミットに含め、中間状態での実行を回避

## References
- [Vite静的アセットの扱い](https://vite.dev/guide/assets.html#the-public-directory) — `public/` ディレクトリの規約
- [Vitest テスト設定](https://vitest.dev/config/#include) — テストファイルパターンの設定
