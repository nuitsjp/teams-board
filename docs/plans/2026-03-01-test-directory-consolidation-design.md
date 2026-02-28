# テストディレクトリ統合設計

**日付**: 2026-03-01
**目的**: ルートディレクトリの散逸を解消し、テスト関連のファイルを `tests/` に集約する

## 背景

ルートディレクトリに 24 個のディレクトリと 17 個の設定ファイルが存在し、見通しが悪い。`e2e/`、`playwright.config.js`、`playwright-report/`、`test-results/` がルートに散在しており、テスト関連の資産が分散している。

## 設計方針

**アプローチ A: 完全統合** を採用。一度にすべてのテスト関連ファイルを `tests/` に集約する。

## ディレクトリ構造

### Before

```
（ルート）
├── e2e/                       ← 独立した E2E テスト
│   ├── *.spec.js (4 ファイル)
│   ├── global-setup.js
│   ├── global-teardown.js
│   └── helpers/ (3 ファイル)
├── tests/                     ← ユニットテスト
│   ├── data/ (7 ファイル)
│   ├── logic/ (2 ファイル)
│   ├── react/
│   ├── utils/ (1 ファイル)
│   ├── fixtures/ (4 CSV)
│   ├── vitest.setup.js
│   └── smoke.test.js
├── playwright.config.js
├── playwright-report/
└── test-results/
```

### After

```
tests/
├── playwright.config.js       ← ルートから移動
├── vitest.setup.js            ← 位置変更なし
├── e2e/                       ← ルートの e2e/ から移動
│   ├── admin-dev-mode.spec.js
│   ├── admin-group-edit.spec.js
│   ├── admin.spec.js
│   ├── dashboard.spec.js
│   ├── global-setup.js
│   ├── global-teardown.js
│   └── helpers/
│       ├── fixture-lifecycle.js
│       ├── navigation.js
│       └── route-fixtures.js
├── unit/                      ← 既存テストを再組織
│   ├── data/
│   ├── logic/
│   ├── react/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── utils/
│   ├── utils/
│   └── smoke.test.js
├── fixtures/                  ← 位置変更なし
├── playwright-report/         ← ルートから移動 (.gitignore)
└── test-results/              ← ルートから移動 (.gitignore)
```

### ルートから削除されるもの（4 項目）

- `e2e/` → `tests/e2e/`
- `playwright.config.js` → `tests/playwright.config.js`
- `playwright-report/` → `tests/playwright-report/`
- `test-results/` → `tests/test-results/`

## 設定ファイルの変更

### tests/playwright.config.js

`tests/` に移動。内部の相対パス（`testDir: './e2e'` 等）はそのまま利用可能。レポート出力先を明示的に設定する。

### vite.config.js（Vitest 設定）

```js
// Before
include: ['tests/**/*.test.{js,jsx}'],

// After
include: ['tests/unit/**/*.test.{js,jsx}'],
```

`setupFiles` は `'./tests/vitest.setup.js'` のまま変更不要。

### package.json（scripts）

```json
"test:e2e": "playwright test --config tests/playwright.config.js",
"test:e2e:headed": "playwright test --headed --config tests/playwright.config.js"
```

### .gitignore

```gitignore
# Before
/playwright-report/
/test-results/

# After
tests/playwright-report/
tests/test-results/
```

### CI ワークフロー（.github/workflows/app-deployment.yml）

- paths フィルター: `e2e/**` → `tests/e2e/**`
- アーティファクト path: `playwright-report/` → `tests/playwright-report/`

### e2e/helpers/fixture-lifecycle.js

`dev-fixtures/data/` へのパスがネスト階層の変更により調整が必要。

### CLAUDE.md

テスト構造の説明セクションを更新。

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| E2E テストのパス解決が壊れる | CI が通らない | `fixture-lifecycle.js` のパスを精査、移動後に E2E テスト実行 |
| Vitest の include パターン不一致 | テストが検出されない | `tests/unit/**/*.test.{js,jsx}` でマッチ確認 |
| CI の paths フィルターの漏れ | 変更がトリガーされない | push/PR 両方のフィルターを更新 |

## 検証手順

1. `pnpm test` — 全ユニットテストがパス
2. `pnpm run test:e2e` — 全 E2E テストがパス
3. `pnpm run test:coverage` — カバレッジ閾値 (90%) クリア
4. `pnpm run build` — ビルド成功
5. `pnpm run lint` — lint パス
