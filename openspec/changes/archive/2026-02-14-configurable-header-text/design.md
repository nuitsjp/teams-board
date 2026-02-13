## Context

ヘッダーのタイトルは `VITE_APP_TITLE` 環境変数で設定可能だが、説明文「Teams レポート集計ダッシュボード」は `App.jsx` にハードコードされている。既存の `configurable-site-header` スペックではタイトルのみを対象としており、説明文の設定は含まれていない。

現在のヘッダー構造:
- タイトル: `import.meta.env.VITE_APP_TITLE || 'Teams Board'` — 環境変数で設定可能
- 説明文: `'Teams レポート集計ダッシュボード'` — ハードコード

## Goals / Non-Goals

**Goals:**

- ヘッダーの説明文を環境変数 `VITE_APP_DESCRIPTION` で設定可能にする
- 既存の `VITE_APP_TITLE` パターンと一貫性を保つ
- 環境変数未設定時のデフォルト動作を維持する

**Non-Goals:**

- `index.html` の `<title>` タグの動的化（別課題）
- 説明文のスタイリング変更（現在の `text-xs text-text-muted` を維持）
- `app-config.js` への集約（`VITE_APP_TITLE` が直接 `import.meta.env` を参照しているため、同じパターンを踏襲）

## Decisions

### 1. 環境変数名: `VITE_APP_DESCRIPTION`

**選択**: `VITE_APP_DESCRIPTION`

**理由**: `VITE_APP_TITLE` と同じ命名規則（`VITE_APP_` プレフィクス）に揃える。`VITE_APP_SUBTITLE` も候補だが、UIの表示位置がサブタイトルというよりサイト説明に近いため `DESCRIPTION` を採用。

### 2. 参照方法: `import.meta.env` を直接参照

**選択**: `App.jsx` 内で `import.meta.env.VITE_APP_DESCRIPTION` を直接参照

**代替案**: `app-config.js` に集約する方法もあるが、`VITE_APP_TITLE` が既に `App.jsx` 内で `import.meta.env` を直接参照しているため、一貫性を優先してそのパターンを踏襲する。

### 3. デフォルト値: 空文字列（非表示）

**選択**: `VITE_APP_DESCRIPTION` 未設定時は説明文を**非表示**にする

**理由**: タイトルと異なり、説明文は必須ではない。環境ごとに表示する/しないを選べるようにしたい場合、デフォルトを空にして明示的に設定した環境のみ表示する方が柔軟。`.env.example` にはコメント付きで記載し、設定方法を明示する。

### 4. 条件付きレンダリング

**選択**: `VITE_APP_DESCRIPTION` が truthy な場合のみ `<span>` を描画

**理由**: 未設定時に空の `<span>` が残るとレイアウトに不要な `ml-2` マージンが発生する。条件付きレンダリングで DOM から完全に除外する。

## Risks / Trade-offs

- **[リスク] デフォルト非表示** → `.env.example` のコメントと CLAUDE.md の記載で設定方法を周知。既存の `.env.study-log` にも値を追加すれば既存環境の表示は維持される。
- **[トレードオフ] `app-config.js` に集約しない** → 将来的に設定項目が増えた場合、`app-config.js` への集約を検討する。現時点では2項目のみなので過剰な抽象化を避ける。
