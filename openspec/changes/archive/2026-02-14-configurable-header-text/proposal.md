## Why

ヘッダーのタイトル（`VITE_APP_TITLE`）は環境変数で設定可能だが、先日追加したサイト説明文「Teams レポート集計ダッシュボード」は `App.jsx` にハードコードされている。複数環境（teams-board.dev / teams-board.prod / study-log）でタイトルと説明文をそれぞれカスタマイズしたいが、現状では説明文を変更するにはコードの修正が必要になる。

## What Changes

- 新しいビルド時環境変数 `VITE_APP_DESCRIPTION` を導入し、ヘッダーの説明文を設定可能にする
- `App.jsx` のハードコードされた説明文を環境変数参照に置き換える
- `VITE_APP_DESCRIPTION` が未設定の場合はデフォルト値にフォールバックする（既存の `VITE_APP_TITLE` と同じパターン）
- `.env.example` に `VITE_APP_DESCRIPTION` を追加

## Capabilities

### New Capabilities

- `header-config`: ヘッダーのタイトルと説明文を環境変数で設定する機能

### Modified Capabilities

（既存スペックへの要件変更なし）

## Impact

- `src/App.jsx` — ヘッダーの説明文を環境変数参照に変更
- `src/config/app-config.js` — 説明文の設定を追加（任意）
- `.env.example` — 新しい環境変数のドキュメント
- ビルドパイプライン — 新しい `VITE_` 変数が自動的にバンドルに含まれるため、CI/CD への変更は不要
