## Why

`configurable-site-header` スペックでは、`VITE_APP_TITLE` 環境変数によってブラウザタブの `<title>` タグとヘッダーのブランド名の両方を設定可能であることが要求されている。しかし現状、`App.jsx` のヘッダーテキストは対応済みだが、`index.html` の `<title>Teams Board</title>` はハードコードのままであり、スペックの要件を満たしていない。

## What Changes

- `index.html` の `<title>` タグに `VITE_APP_TITLE` 環境変数の値を反映する仕組みを追加する
- 環境変数が未設定の場合はデフォルト値「Teams Board」を維持する
- Vite の `transformIndexHtml` フック、または React 側での `document.title` 設定のいずれかで対応する

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `configurable-site-header`: `<title>` タグへの `VITE_APP_TITLE` 反映が未実装であるため、既存スペックの要件に合致するよう実装を追加する（スペック自体の要件変更は不要）

## Impact

- `index.html` — `<title>` タグの値が動的に決定されるようになる
- `vite.config.js` または `src/App.jsx` / `src/main.jsx` — 実装方式に応じて変更が必要
- 既存のヘッダー表示動作には影響なし
